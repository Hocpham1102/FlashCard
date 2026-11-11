# Báo Cáo Phân Tích Kỹ Thuật: Prisma Client Singleton, Quản Lý Môi Trường (.env.example) & Tương Thích Signature
**Người thực hiện:** Explorer M2-2 (`teamwork_explorer_m2_2`)  
**Mục tiêu:** Milestone 2 (Prisma & Database Foundation)  
**Ngày báo cáo:** 2026-11-10  
**Chế độ khảo sát:** Read-Only Investigation (Khảo sát, thiết kế giải pháp kỹ thuật)

---

## 1. TỔNG QUAN & TÓM TẮT PHÁT HIỆN CHÍNH (EXECUTIVE SUMMARY)

1. **Khuyết điểm nghiêm trọng trong `src/lib/prisma.ts`:**
   - Đang tồn tại lời gọi hàm `$connect()` cấp module (`top-level eager connect`) tại dòng 9-18. Lời gọi này thực thi ngay khi file được import.
   - Khi Next.js chạy lệnh `npm run build`, các route handler được Next.js import để phân tích trang tĩnh. Do môi trường build thường không có kết nối cơ sở dữ liệu thật hoặc thiếu biến môi trường, câu lệnh này liên tục bắn ra lỗi `❌ Failed to connect to Supabase database: PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL` (lặp lại hơn 15 lần).
   - Kiến trúc chuẩn của Prisma là **kết nối lười (lazy connection)** — Prisma sẽ tự động kết nối khi query đầu tiên được `await`. Việc gọi `$connect()` ở module top-level là một lỗi phản mẫu (anti-pattern).

2. **Thiếu hoàn toàn file cấu hình môi trường `.env` và `.env.example`:**
   - Trong toàn bộ repository hiện không hề có bất kỳ file `.env*` nào.
   - Khi chạy `npx prisma validate`, Prisma CLI 5.22.0 lập tức ném lỗi `Error code: P1012: error: Environment variable not found: DIRECT_URL.` và dừng lại với exit code 1.
   - Bảng `datasource` trong `prisma/schema.prisma` định nghĩa cả `url = env("DATABASE_URL")` và `directUrl = env("DIRECT_URL")`. Do đó, cả hai biến này đều bắt buộc phải tồn tại trong `.env` để vượt qua kiểm tra của Prisma CLI.
   - Rà soát toàn bộ codebase xác định tổng cộng **8 biến môi trường** đang được ứng dụng tham chiếu: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`.

3. **Hiện trạng Import Prisma Client trong dự án:**
   - Tổng cộng có **23 file** trong codebase import Prisma Client từ `src/lib/prisma.ts`.
   - Trong đó:
     - **12 file** sử dụng named import: `import { prisma } from "@/lib/prisma";`
     - **10 file** sử dụng default import: `import prisma from "@/lib/prisma";`
     - **1 file** (`src/lib/gamification.ts`) sử dụng relative default import: `import prisma from "./prisma";`
   - **Yêu cầu tương thích bắt buộc:** File `src/lib/prisma.ts` bắt buộc phải export đồng thời cả `export const prisma` và `export default prisma;`. Nếu thiếu một trong hai, 50% codebase sẽ gãy biên dịch TypeScript ngay lập tức.

---

## 2. PHÂN TÍCH CHUYÊN SÂU `src/lib/prisma.ts` & THIẾT KẾ LAZY SINGLETON

### 2.1 Hiện trạng mã nguồn `src/lib/prisma.ts`
```typescript
// src/lib/prisma.ts (Hiện tại)
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (!globalForPrisma.prisma) {
  prisma
    .$connect()
    .then(() => {
      console.log("✅ Successfully connected to Supabase database");
    })
    .catch((error: unknown) => {
      console.error("❌ Failed to connect to Supabase database:", error);
    });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

### 2.2 Các rủi ro kỹ thuật của việc gọi `$connect()` ở Top-Level
1. **Lỗi Build-time & Module Evaluation Side Effect:**
   - Khi chạy `next build`, Webpack/Turbopack nạp mã nguồn của tất cả 20+ API routes trong `src/app/api/...` để thu thập route segments và build tĩnh.
   - Tại dòng 9-18, ngay khi `src/lib/prisma.ts` được nạp, promise `prisma.$connect()` được khởi tạo ngay lập tức mà không có sự kiện kích hoạt từ request.
   - Khi môi trường CI/CD hoặc máy lập trình viên chưa khởi tạo database, promise này rejected và in ra hàng loạt thông báo lỗi đỏ. Trong trường hợp có unhandled promise rejections khắt khe, tiến trình build sẽ bị đình trệ hoặc thất bại.
2. **Khởi động chậm trong môi trường Serverless (Cold Start Penalty):**
   - Trong Serverless (như Vercel Functions), việc khởi tạo kết nối TCP/TLS ngay trong giai đoạn nạp module (module initialization phase) làm tăng thời gian cold-start không cần thiết, ngay cả với các request chỉ xử lý logic tĩnh hoặc bị từ chối từ bước xác thực token.
3. **Mất khả năng bắt lỗi theo ngữ cảnh request (Error Context Loss):**
   - Lỗi kết nối ở top-level chỉ in ra `console.error`, không trả về mã HTTP 500 hay thông báo có cấu trúc cho client. Khi client gọi route, Prisma Client phải tự thử kết nối lại, tạo ra 2 lần log lỗi không đồng bộ.
4. **Bất đối xứng với cơ chế Native của Prisma:**
   - Prisma Client được thiết kế theo cơ chế **Lazy Connection**: Kết nối vật lý đến cơ sở dữ liệu chỉ được mở khi câu lệnh truy vấn đầu tiên (`prisma.<model>.find...`, `$transaction`, `$queryRaw`) được thực thi. Do đó, việc gọi tường minh `$connect()` ở cấp độ toàn cục là hoàn toàn dư thừa.

### 2.3 Phân tích Cấu hình Connection Pooling (PgBouncer & Supavisor)
- Trong `prisma/schema.prisma`:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
- **DATABASE_URL (Transaction Pooler):**
  - Kết nối qua cổng `6543` của Supabase (PgBouncer hoặc Supavisor).
  - Hoạt động ở chế độ Transaction Pooling: Mỗi transaction mượn một connection từ pool và trả lại ngay sau khi xong.
  - Cần tham số: `?pgbouncer=true` để Prisma Client không sử dụng prepared statements (tránh lỗi xung đột session trên pool).
  - Cần tham số giới hạn connection: `&connection_limit=1` (đối với Serverless Functions) hoặc `&connection_limit=5` (đối với Node server thông thường).
- **DIRECT_URL (Direct Connection):**
  - Kết nối trực tiếp vào cổng `5432` của PostgreSQL.
  - Được Prisma CLI sử dụng khi chạy `prisma migrate`, `prisma db push`, `npx prisma validate`.
  - Các lệnh migrate yêu cầu toàn quyền quản lý session và khóa bảng (table locks/advisory locks), điều mà Transaction Pooler không hỗ trợ.

### 2.4 Phân tích Cấu hình Logging & Monitoring
- Hiện tại, `new PrismaClient()` không truyền bất kỳ tham số nào (`log: undefined`).
- Trong quá trình phát triển (development), việc ghi nhận log câu truy vấn (`query`), cảnh báo (`warn`), và lỗi (`error`) giúp lập trình viên phát hiện sớm:
  - Các truy vấn N+1.
  - Thời gian phản hồi của câu query chậm (slow queries).
  - Lỗi vi phạm ràng buộc toàn vẹn dữ liệu.
- Trong môi trường sản xuất (production), chỉ nên ghi nhận log cấp `error` để tránh suy giảm hiệu năng I/O và tránh rò rỉ dữ liệu người dùng ra stdout.

### 2.5 Thiết Kế Safe Lazy Singleton Cho `src/lib/prisma.ts`
Dưới đây là mẫu thiết kế chuẩn theo khuyến nghị chính thức của Prisma và Next.js (sử dụng factory function và typed global):

```typescript
import { PrismaClient } from "@prisma/client";

// Factory function tạo PrismaClient với logging phù hợp từng môi trường
const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

// Giữ instance trên globalThis để tránh mở nhiều kết nối khi Next.js Fast Refresh
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// Khởi tạo instance lười (lazy): chỉ tái sử dụng hoặc tạo mới instance, KHÔNG gọi $connect()
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Lưu vào globalThis trong môi trường dev
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Default export để đảm bảo tương thích ngược 100% với các file import prisma mặc định
export default prisma;
```

---

## 3. RÀ SOÁT BIẾN MÔI TRƯỜNG & THIẾT KẾ `.env.example`

### 3.1 Bảng Kiểm Kê Toàn Bộ Biến Môi Trường Trong Dự Án

| Tên biến | Vị trí sử dụng trong mã nguồn | Phân loại | Mục đích & Mô tả | Giá trị mẫu an toàn |
|---|---|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma:7` | **BẮT BUỘC** | Chuỗi kết nối DB cho ứng dụng. Trong Supabase sử dụng cổng pooler 6543 với `?pgbouncer=true`. | `postgresql://postgres:postgres@localhost:5432/flashcard?schema=public` |
| `DIRECT_URL` | `prisma/schema.prisma:8` | **BẮT BUỘC** (Prisma CLI) | Chuỗi kết nối trực tiếp cổng 5432 dùng cho Prisma Migrate và `prisma validate`. | `postgresql://postgres:postgres@localhost:5432/flashcard?schema=public` |
| `NEXTAUTH_URL` | NextAuth core config, `README.md:75` | **BẮT BUỘC** (Local/Prod) | URL gốc của website dùng cho redirect và xử lý callback OAuth. | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | `src/lib/auth.ts:11`, `api/user/stats/route.ts:12` | **BẮT BUỘC** | Khóa bí mật mã hóa JWT session token (tối thiểu 32 ký tự). | `dev-nextauth-secret-key-32-chars-minimum!` |
| `AUTH_SECRET` | `src/lib/auth.ts:11` | *Tùy chọn* | Giá trị dự phòng cho `NEXTAUTH_SECRET` (chuẩn NextAuth v5). | Trùng `NEXTAUTH_SECRET` |
| `GOOGLE_CLIENT_ID` | `src/lib/auth.ts:61` | *Tùy chọn* | Client ID cho Google OAuth đăng nhập bằng tài khoản Google. | `your-google-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `src/lib/auth.ts:62` | *Tùy chọn* | Client Secret cho Google OAuth đăng nhập. | `your-google-client-secret` |
| `GEMINI_API_KEY` | `api/ai/generate:7,16`, `api/decks/import-ai:7,11` | *Bắt buộc khi dùng AI* | API Key của Google Gemini AI để sinh bộ thẻ tự động và đọc file tài liệu. | `your-gemini-api-key-here` |
| `PORT` | `package.json:8` | *Tùy chọn* | Cổng lắng nghe khi chạy `npm run start` trên PaaS (Heroku, Render). | `3000` |

### 3.2 Hiện Tượng Lỗi `npx prisma validate` & Hướng Khắc Phục
- **Hiện tượng thực tế khi chạy không có `.env`:**
  ```text
  Prisma schema loaded from prisma\schema.prisma
  Error: Prisma schema validation - (get-config wasm)
  Error code: P1012
  error: Environment variable not found: DIRECT_URL.
    -->  prisma\schema.prisma:8
     | 
   7 |   url       = env("DATABASE_URL")
   8 |   directUrl = env("DIRECT_URL")
     | 
  Validation Error Count: 1
  ```
- **Nguyên nhân:** Prisma CLI đọc khối `datasource db` và yêu cầu mọi biến trong hàm `env(...)` phải được định nghĩa trong môi trường tiến trình hoặc trong file `.env` tại thư mục gốc dự án.
- **Xác nhận thực nghiệm:**
  Khi thiết lập biến môi trường với cú pháp URL hợp lệ:
  ```powershell
  $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flashcard?schema=public"
  $env:DIRECT_URL="postgresql://postgres:postgres@localhost:5432/flashcard?schema=public"
  npx prisma validate
  ```
  Kết quả trả về thành công 100%:
  ```text
  The schema at prisma\schema.prisma is valid 🚀
  ```
- **Giải pháp:**
  1. Tạo file `.env.example` với đầy đủ chú thích và giá trị mặc định cho môi trường cục bộ (Local PostgreSQL).
  2. Bổ sung hướng dẫn tạo `.env` từ `.env.example` trong tài liệu dự án và trong các script kiểm thử tự động (CI test runner): Nếu file `.env` chưa tồn tại, tự động sao chép từ `.env.example`.

### 3.3 Nội Dung Hoàn Chỉnh Đề Xuất Cho `.env.example`

```env
# ==============================================================================
# FLASHCARD APPLICATION - ENVIRONMENT VARIABLES TEMPLATE
# ==============================================================================
# Hướng dẫn:
# 1. Sao chép file này thành .env trong thư mục gốc:
#      cp .env.example .env
#    (Trên Windows PowerShell: Copy-Item .env.example .env)
# 2. Cập nhật các thông số kết nối cơ sở dữ liệu và API keys của bạn.
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. DATABASE CONFIGURATION (PostgreSQL / Supabase)
# ------------------------------------------------------------------------------
# DATABASE_URL:
# Dùng cho Prisma Client để truy vấn dữ liệu từ ứng dụng.
# Với Supabase, sử dụng connection string qua Pooler (PgBouncer/Supavisor, cổng 6543)
# kèm tham số ?pgbouncer=true&connection_limit=1 (trong môi trường Serverless).
# Giá trị mặc định chạy PostgreSQL local:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flashcard?schema=public"

# DIRECT_URL:
# Dùng cho Prisma CLI khi chạy migrate, db push, và prisma validate.
# Bắt buộc phải là kết nối trực tiếp không qua Transaction Pooler (cổng 5432).
# LƯU Ý: Lệnh 'npx prisma validate' sẽ báo lỗi P1012 nếu thiếu biến này.
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/flashcard?schema=public"

# ------------------------------------------------------------------------------
# 2. NEXTAUTH AUTHENTICATION CONFIGURATION
# ------------------------------------------------------------------------------
# NEXTAUTH_URL:
# Địa chỉ URL gốc của ứng dụng (dùng cho chuyển hướng và callback URL).
NEXTAUTH_URL="http://localhost:3000"

# NEXTAUTH_SECRET:
# Khóa bí mật để ký và mã hóa JWT session token.
# Tạo chuỗi ngẫu nhiên bảo mật bằng lệnh: openssl rand -base64 32
NEXTAUTH_SECRET="flashcard-development-secret-key-must-be-at-least-32-chars-long!"

# AUTH_SECRET (Tùy chọn, dự phòng cho NEXTAUTH_SECRET):
AUTH_SECRET="flashcard-development-secret-key-must-be-at-least-32-chars-long!"

# ------------------------------------------------------------------------------
# 3. GOOGLE OAUTH PROVIDER (Tùy chọn cho đăng nhập thông thường)
# ------------------------------------------------------------------------------
# Lấy thông tin từ Google Cloud Console (APIs & Services > Credentials).
# Để trống nếu chỉ sử dụng đăng nhập bằng tài khoản nội bộ (Username/Password).
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ------------------------------------------------------------------------------
# 4. GOOGLE GEMINI AI CONFIGURATION (Bắt buộc cho tính năng AI)
# ------------------------------------------------------------------------------
# Dùng cho tính năng tạo bộ thẻ TOEIC tự động bằng AI và trích xuất file thông minh.
# Đăng ký lấy API key miễn phí tại: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=""

# ------------------------------------------------------------------------------
# 5. SERVER RUNTIME SETTINGS (Tùy chọn)
# ------------------------------------------------------------------------------
# PORT=3000
# NODE_ENV=development
```

---

## 4. MA TRẬN KIỂM KÊ IMPORT TOÀN DỰ ÁN & ĐẢM BẢO TƯƠNG THÍCH NGƯỢC

### 4.1 Danh sách chi tiết 23 file tham chiếu `prisma.ts`

| STT | Đường dẫn file | Cú pháp Import cụ thể | Loại Import |
|---|---|---|---|
| 1 | `src/app/api/admin/decks/route.ts` (dòng 5) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 2 | `src/app/api/admin/decks/[id]/route.ts` (dòng 3) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 3 | `src/app/api/admin/stats/route.ts` (dòng 5) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 4 | `src/app/api/admin/users/route.ts` (dòng 5) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 5 | `src/app/api/admin/users/[id]/route.ts` (dòng 3) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 6 | `src/app/api/admin/users/[id]/role/route.ts` (dòng 3) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 7 | `src/app/api/ai/generate/route.ts` (dòng 4) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 8 | `src/app/api/auth/change-password/route.ts` (dòng 4) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 9 | `src/app/api/auth/register/route.ts` (dòng 1) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 10 | `src/app/api/cards/[id]/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 11 | `src/app/api/cards/[id]/review/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 12 | `src/app/api/decks/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 13 | `src/app/api/decks/import/route.ts` (dòng 2) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 14 | `src/app/api/decks/import-ai/route.ts` (dòng 2) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 15 | `src/app/api/decks/[id]/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 16 | `src/app/api/decks/[id]/cards/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 17 | `src/app/api/decks/[id]/study/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 18 | `src/app/api/quiz/generate/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 19 | `src/app/api/quiz/submit/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 20 | `src/app/api/user/analytics/route.ts` (dòng 1) | `import prisma from "@/lib/prisma";` | **Default** |
| 21 | `src/app/api/user/stats/route.ts` (dòng 4) | `import prisma from "@/lib/prisma";` | **Default** |
| 22 | `src/lib/auth.ts` (dòng 2) | `import { prisma } from "@/lib/prisma";` | **Named** |
| 23 | `src/lib/gamification.ts` (dòng 2) | `import prisma from "./prisma";` | **Default (Relative)** |

### 4.2 Phân Tích Tương Thích & Quy Chuẩn Xuất Bản
- **Thống kê:**
  - 12 module dùng Named Import (`import { prisma } ...`).
  - 11 module dùng Default Import (`import prisma ...`).
- **Hệ quả nếu chỉ export 1 dạng:**
  - Nếu chỉ `export default prisma`: 12 module named import sẽ bị lỗi TypeScript `TS2614: Module '"@/lib/prisma"' has no exported member 'prisma'`.
  - Nếu chỉ `export const prisma`: 11 module default import sẽ bị lỗi TypeScript `TS1192: Module '"@/lib/prisma"' has no default export`.
- **Giải pháp tối ưu không gây side-effect:**
  Khai báo `export const prisma = ...` đồng thời với `export default prisma;`. Cả hai kiểu cú pháp import sẽ đều hoạt động trong suốt mà không cần phải thay đổi 23 file đang hoạt động, tránh tạo xung đột mã nguồn với các nhánh của Milestone 1 (Linting/Typecheck) và Milestone 3 (Authorization).

---

## 5. KẾ HOẠCH TRIỂN KHAI CHO IMPLEMENTER (MILESTONE 2)

### Bước 1: Tạo file cấu hình môi trường `.env.example`
- Tạo file `.env.example` tại thư mục gốc `e:\GitHub\FlashCard\.env.example` với nội dung đã được thiết kế tại Mục 3.3.
- Tạo sẵn bản sao `.env` cục bộ chứa cấu hình mặc định để phục vụ các bước kiểm tra build và validate:
  `Copy-Item .env.example .env`

### Bước 2: Cập nhật `src/lib/prisma.ts`
- Áp dụng mẫu Safe Lazy Singleton tại Mục 2.5:
  - Loại bỏ hoàn toàn khối `if (!globalForPrisma.prisma) { prisma.$connect()... }`.
  - Thêm factory function `prismaClientSingleton` có cấu hình `log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]`.
  - Giữ lại cả `export const prisma` và `export default prisma;`.

### Bước 3: Xác minh tính đúng đắn độc lập
- Chạy `npx prisma validate`: Phải trả về `The schema at prisma\schema.prisma is valid 🚀` với exit code 0.
- Chạy `node node_modules/prisma/build/index.js generate`: Sinh mã client thành công vào `node_modules/@prisma/client`.
- Kiểm tra tính tương thích TypeScript: `npx tsc --noEmit` không phát sinh bất kỳ lỗi nào liên quan đến `@/lib/prisma`.
