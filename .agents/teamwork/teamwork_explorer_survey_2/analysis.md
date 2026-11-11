# Báo Cáo Khảo Sát Toàn Diện: Kiến Trúc Database, Prisma Schema & ORM
**Dự án:** FlashCard (Intelligent TOEIC Learning Platform)  
**Tác giả khảo sát:** Explorer 2 (`teamwork_explorer_survey_2`)  
**Ngày khảo sát:** 2026-11-10  
**Chế độ khảo sát:** Read-Only Investigation (Khảo sát khách quan, không chỉnh sửa mã nguồn)

---

## 1. TỔNG QUAN HỆ THỐNG DỮ LIỆU & PRISMA DIAGNOSTICS

### 1.1 Kết quả kiểm tra lệnh chẩn đoán (`npx prisma validate`, `prisma generate`)

1. **Kết quả `npx prisma validate` khi chạy mặc định:**
   - **Lỗi 1 (Môi trường/Binary resolution):** Khi thực thi `npx prisma validate`, ban đầu hệ thống `npx` không tìm thấy liên kết binary local `prisma` trong `node_modules/.bin/prisma`, dẫn đến việc `npx` tự động tải gói mới nhất từ registry npm (`prisma@7.10.1`). 
   - **Lỗi 2 (Prisma 7 breaking changes):** Phiên bản `prisma@7.10.1` lập tức báo lỗi cú pháp không tương thích với `prisma/schema.prisma` của dự án (Prisma 7 đã bãi bỏ `url` và `directUrl` trong khối `datasource`, chuyển cấu hình kết nối sang `prisma.config.ts`):
     ```text
     Error: Prisma schema validation - (validate wasm)
     Error code: P1012
     error: The datasource property `url` is no longer supported in schema files. Move connection URLs for Migrate to `prisma.config.ts`...
     error: The datasource property `directUrl` is no longer supported in schema files...
     ```
   - **Lỗi 3 (Thiếu biến môi trường khi chạy đúng bản local Prisma 5.22.0):**
     Khi kích hoạt đúng binary của dự án (`node node_modules\prisma\build\index.js validate` hoặc `npx prisma validate` sau khi nhận diện binary local), lệnh tiếp tục thất bại với mã lỗi **P1012**:
     ```text
     Error: Prisma schema validation - (get-config wasm)
     Error code: P1012
     error: Environment variable not found: DIRECT_URL.
       --> prisma\schema.prisma:8
        | 
      7 | url = env("DATABASE_URL")
      8 | directUrl = env("DIRECT_URL")
        | 
     Validation Error Count: 1
     ```
   - **Xác minh khi cung cấp đủ biến môi trường:**
     Khi thiết lập giả lập cả 2 biến môi trường `DATABASE_URL` và `DIRECT_URL`:
     ```powershell
     $env:DATABASE_URL="postgresql://user:pass@localhost:5432/flashcard"; $env:DIRECT_URL="postgresql://user:pass@localhost:5432/flashcard"; npx prisma validate
     ```
     Lệnh trả về kết quả: `The schema at prisma\schema.prisma is valid 🚀` (Exit code: 0).
   - **Kết luận:** Lệnh `npx prisma validate` **thất bại** trong điều kiện chạy tự động / CI do thiếu file `.env` và biến `DIRECT_URL` bắt buộc.

2. **Kết quả `prisma generate`:**
   - Khi chạy `node node_modules\prisma\build\index.js generate`:
     ```text
     ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 216ms
     ```
     Lệnh hoàn thành thành công và sinh mã Prisma Client phiên bản 5.22.0 vào `node_modules/@prisma/client`.

3. **Tình trạng file cấu hình môi trường (.env):**
   - Trong toàn bộ repository, hoàn toàn **KHÔNG TỒN TẠI** file `.env`, `.env.example`, hay `.env.local`.
   - File `README.md` (dòng 69-80) có hướng dẫn tạo `.env`, nhưng lập trình viên mới clone mã nguồn hoặc các pipeline CI tự động sẽ ngay lập tức bị lỗi build/validate do thiếu biến `DATABASE_URL` và `DIRECT_URL`.

---

## 2. PHÂN TÍCH DI CHUYỂN DỮ LIỆU & LỆCH PHA SCHEMA (MIGRATION & SCHEMA DRIFT)

### 2.1 Lịch sử Migration hiện có
Trong thư mục `prisma/migrations/`, chỉ tồn tại **duy nhất 1 migration**:
- Thư mục: `prisma/migrations/20260424102124_add_user_role/`
- File: `migration.sql`
- File: `migration_lock.toml` (`provider = "postgresql"`)

### 2.2 So sánh đối chiếu `schema.prisma` và `migration.sql`

| Thành phần | Có trong `schema.prisma` | Có trong `migration.sql` | Mức độ nghiêm trọng | Hậu quả thực tế |
|---|---|---|---|---|
| **Bảng `Deck`** | Đầy đủ 10 cột | Chỉ có 7 cột | **CRITICAL** | Thiếu `category`, `toeicParts`, `isPublic`. Nếu chạy `prisma migrate deploy`, lỗi SQL missing column. |
| **Bảng `Card`** | Đầy đủ 20 cột | Chỉ có 10 cột | **CRITICAL** | Thiếu 10 cột: `phonetic`, `example`, `partOfSpeech`, `synonyms`, `antonyms`, `collocations`, `toeicPart`, `difficulty`, `audioUrl`, `lastReviewed`. Thiếu chỉ mục `Card_nextReview_idx`. |
| **Bảng `CardReview`** | Model có khai báo | **KHÔNG TỒN TẠI** | **BLOCKER** | Lỗi runtime `relation "CardReview" does not exist` khi lưu đánh giá thẻ. |
| **Bảng `QuizSession`** | Model có khai báo | **KHÔNG TỒN TẠI** | **BLOCKER** | Lỗi runtime `relation "QuizSession" does not exist` khi tạo quiz. |
| **Bảng `QuizAnswer`** | Model có khai báo | **KHÔNG TỒN TẠI** | **BLOCKER** | Lỗi runtime `relation "QuizAnswer" does not exist` khi nộp bài quiz. |
| **Bảng `UserStats`** | Model có khai báo | **KHÔNG TỒN TẠI** | **BLOCKER** | Lỗi runtime `relation "UserStats" does not exist` khi truy vấn XP, streak. |
| **Bảng `DailyActivity`** | Model có khai báo | **KHÔNG TỒN TẠI** | **BLOCKER** | Lỗi runtime `relation "DailyActivity" does not exist` khi lấy biểu đồ 14 ngày. |
| **Bảng `Achievement`** | Model có khai báo | **KHÔNG TỒN TẠI** | Low | Model thừa không dùng trong code. |
| **Bảng `User`** | 10 cột (thiếu createdAt) | 10 cột | Medium | Đồng bộ với migration nhưng thiếu các cột chuẩn. |
| **Bảng `Account`** | 12 cột | 12 cột | Low | Đồng bộ với NextAuth schema. |
| **Bảng `Session`** | 5 cột | 5 cột | Low | Đồng bộ với NextAuth schema. |
| **Bảng `VerificationToken`**| 3 cột | 3 cột | Low | Đồng bộ với NextAuth schema. |

### 2.3 Nguyên nhân gốc rễ và rủi ro triển khai
- Trong `README.md` dòng 85 ghi: `npx prisma db push`. Dự án đã bỏ qua quy trình migrate chuẩn (`prisma migrate dev`) và sử dụng trực tiếp `prisma db push` trên database dev của Supabase.
- **Rủi ro sản xuất:** Nếu dự án được triển khai lên Production (Vercel, Railway, Render, Docker) với script `prisma migrate deploy`, database sẽ chỉ tạo 6 bảng cũ từ migration `20260424102124_add_user_role`. Mọi chức năng mới (Quiz, Gamification, SRS Review, AI Deck với từ loại/phiên âm) sẽ **sập hoàn toàn**.

### 2.4 Tình trạng Seed Scripts
- Kiểm tra toàn bộ dự án: **KHÔNG TỒN TẠI** bất kỳ file seed script nào (không có `prisma/seed.ts`, không có cấu hình `"prisma": { "seed": ... }` trong `package.json`).
- Không có dữ liệu mẫu cho bộ thẻ TOEIC mặc định, tài khoản admin khởi tạo, hay danh mục TOEIC.

---

## 3. KHẢO SÁT PRISMA CLIENT & INSTANTIATION (KẾT NỐI DATABASE)

### 3.1 Phân tích file `src/lib/prisma.ts`
Mã nguồn hiện tại:
```typescript
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

### 3.2 Các vấn đề kỹ thuật tại `src/lib/prisma.ts`
1. **Lỗi Eager Top-level Connection (`prisma.$connect()` ở phạm vi module):**
   - Đoạn mã dòng 9-18 tự động gọi `prisma.$connect()` ngay khi file được import.
   - Khi Next.js chạy lệnh `npm run build`, Next.js import các route handler và module để phân tích cấu trúc trang tĩnh (SSG/ISR). Vì tại thời điểm build chưa có kết nối database hoặc chưa nạp `.env`, lệnh này kích hoạt và văng ra hàng loạt thông báo lỗi đỏ trong quá trình build:
     ```text
     ❌ Failed to connect to Supabase database: PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL.
     ```
     (Lặp lại hơn 15 lần trong log của `next build`).
   - Theo chuẩn kiến trúc của Prisma & Next.js: **Tuyệt đối không gọi `$connect()` ở top-level của file client**. Prisma sẽ tự động kết nối theo cơ chế lazy connection khi query đầu tiên được `await`.
2. **Nguy cơ cạn kiệt Connection Pool trong môi trường Serverless / Edge:**
   - Dòng 20: `if (process.env.NODE_ENV !== "production") { globalForPrisma.prisma = prisma; }`
   - Trong môi trường Node server truyền thống (`next start`), biến module cache giữ lại instance. Nhưng trong môi trường Serverless (Vercel functions), mỗi cold-start sẽ sinh ra một client mới. Nếu sử dụng trực tiếp cổng Postgres `5432` mà không qua connection pooler (PgBouncer cổng `6543` với tham số `?pgbouncer=true` hoặc Supavisor), số lượng kết nối sẽ nhanh chóng vượt ngưỡng giới hạn của Supabase (thường là 60 kết nối trực tiếp ở gói miễn phí).
3. **Thiếu cấu hình Logging & Error formatting:**
   - Khởi tạo `new PrismaClient()` không truyền tùy chọn log (`log: ['query', 'error', 'warn']`), gây khó khăn cho việc debug hiệu năng và theo dõi câu truy vấn chậm (slow queries).

---

## 4. ĐÁNH GIÁ CHI TIẾT CÁC MODEL & SCHEMA INTEGRITY

### 4.1 Model `User` (Dòng 182-199 trong `schema.prisma`)
- **Thiếu trường mốc thời gian (`createdAt`, `updatedAt`):**
  Model `User` hoàn toàn không có `createdAt DateTime @default(now())` hay `updatedAt DateTime @updatedAt`.
  - **Hậu quả trực tiếp:** Tại `src/app/api/admin/users/route.ts` (dòng 21) và `src/app/api/admin/stats/route.ts` (dòng 34), khi cần sắp xếp danh sách người dùng mới nhất, lập trình viên buộc phải dùng:
    ```typescript
    orderBy: { emailVerified: "desc" }
    ```
    Đối với toàn bộ người dùng đăng ký bằng tài khoản thông thường (username/password), trường `emailVerified` luôn là `null`. Do đó, thứ tự sắp xếp danh sách người dùng trong trang quản trị Admin bị xáo trộn hoàn toàn và không xác định.
- **Vấn đề phân biệt chữ hoa/thường (Case Sensitivity):**
  Trong `src/lib/auth.ts` dòng 33-36:
  ```typescript
  where: {
    OR: [
      { username: { equals: identifier, mode: "insensitive" } },
      { email: { equals: identifier, mode: "insensitive" } },
    ],
  }
  ```
  PostgreSQL khi chạy `mode: "insensitive"` sẽ biên dịch thành `LOWER("username") = LOWER($1)`. Vì B-tree unique index trên `username` và `email` là case-sensitive, câu lệnh này sẽ bỏ qua index và thực hiện **Full Table Scan (Sequential Scan)** trên bảng `User`.

### 4.2 Lỗ hổng cấu trúc SRS (Spaced Repetition System) trên `Card` (Dòng 34-60)
- **Sai sót thiết kế kiến trúc đa người dùng:**
  Các trường trạng thái học tập SM-2 (`easeFactor`, `interval`, `repetitions`, `nextReview`, `lastReviewed`) được đặt trực tiếp trên bảng `Card`.
  - Bảng `Card` thuộc về `Deck` (thông qua `deckId`). Trong khi đó, bảng `Deck` có trường `isPublic Boolean @default(false)` và `userId String?`.
  - Nếu một bộ thẻ được công khai hoặc dùng chung (ví dụ bộ thẻ TOEIC mẫu do Admin tạo), khi **User A** vào học và đánh giá thẻ (gọi `POST /api/cards/[id]/review`), câu lệnh tại `src/app/api/cards/[id]/review/route.ts` dòng 42-51 sẽ trực tiếp cập nhật `nextReview`, `easeFactor`, `interval` trên bản ghi `Card` đó.
  - Khi **User B** vào học bộ thẻ đó (`GET /api/decks/[id]/study`), câu truy vấn `where: { deckId: id, nextReview: { lte: new Date() } }` sẽ **không trả về thẻ nào** vì User A đã đẩy `nextReview` về tương lai 10-30 ngày.
  - **Khuyến nghị kiến trúc:** Cần tách trạng thái học tập thành bảng riêng (ví dụ `UserCardProgress` hoặc tận dụng liên kết `(userId, cardId)`), giữ `Card` làm dữ liệu nội dung bất biến giữa các người dùng.

### 4.3 Model `QuizAnswer` (Dòng 95-107) – Khuyết Foreign Key & Index
- Cấu trúc hiện tại:
  ```prisma
  model QuizAnswer {
    id            String   @id @default(cuid())
    quizSessionId String
    cardId        String
    userAnswer    String
    correctAnswer String
    isCorrect     Boolean
    timeSpentMs   Int      @default(0)
    createdAt     DateTime @default(now())
    quizSession   QuizSession @relation(fields: [quizSessionId], references: [id], onDelete: Cascade)

    @@index([quizSessionId])
  }
  ```
- **Thiếu Foreign Key Constraint:** Trường `cardId` là một chuỗi tự do, không có quan hệ `@relation` với bảng `Card`.
- **Thiếu Index:** Không có `@@index([cardId])`. Khi cần thống kê tỷ lệ trả lời đúng/sai của một thẻ hoặc phân tích câu hỏi khó, database phải quét toàn bộ bảng `QuizAnswer`.
- Khi một `Card` bị xóa, các bản ghi `QuizAnswer` liên quan sẽ giữ lại `cardId` mồ côi (dangling pointer) mà không được cascade.

### 4.4 Các chỉ mục ngoại khóa bị thiếu (Unindexed Foreign Keys)
1. **Model `Account` (Dòng 155-172):**
   `userId String` liên kết với `User.id` nhưng không có `@@index([userId])`. Khi xóa người dùng (Cascade delete) hoặc kiểm tra liên kết tài khoản OAuth của user, PostgreSQL phải quét toàn bảng `Account`.
2. **Model `Session` (Dòng 174-180):**
   `userId String` liên kết với `User.id` nhưng không có `@@index([userId])`.
3. **Model `Card`:**
   Truy vấn học tập gọi nhiều nhất trong hệ thống (`GET /api/decks/[id]/study`):
   ```typescript
   prisma.card.findMany({
     where: { deckId: id, nextReview: { lte: new Date() } }
   })
   ```
   Trong `schema.prisma` chỉ có 2 index đơn lẻ: `@@index([deckId])` và `@@index([nextReview])`. Thiếu chỉ mục kết hợp (Composite Index):
   ```prisma
   @@index([deckId, nextReview])
   ```
   Chỉ mục kết hợp này sẽ giúp truy vấn lấy danh sách thẻ cần ôn tập đạt độ phức tạp O(log N) thay vì phải Bitmap Index Scan.
4. **Model `Deck`:**
   Truy vấn lấy danh sách bộ thẻ của user sắp xếp theo thời gian cập nhật (`src/app/api/decks/route.ts`):
   ```typescript
   where: { userId: session.user.id }, orderBy: { updatedAt: "desc" }
   ```
   Bảng `Deck` chỉ có `@@index([userId])`. Để tối ưu hóa, cần chỉ mục kết hợp `@@index([userId, updatedAt])`.

### 4.5 Lạm dụng cột sai mục đích (Schema Column Overloading / Anti-pattern)
- Tại `src/app/api/decks/import-ai/route.ts` dòng 272:
  ```typescript
  synonyms: card.options && card.options.length > 0 
    ? JSON.stringify(card.options.map(opt => opt.trim())) 
    : "",
  ```
- Tại `src/app/api/quiz/generate/route.ts` dòng 62-81:
  ```typescript
  if (card.synonyms) {
    try {
      const parsedOptions = JSON.parse(card.synonyms);
      if (Array.isArray(parsedOptions) && parsedOptions.length >= 2) {
        options = parsedOptions.map((opt: string) => ({
          text: opt,
          isCorrect: opt === card.back,
        }));
      ...
  ```
- **Phân tích:** Lập trình viên đã nhồi nhét chuỗi JSON các đáp án trắc nghiệm (`options: ["A. ...", "B. ..."]`) vào trường `synonyms` (vốn dùng để lưu từ đồng nghĩa).
  - Khi một thẻ thực sự có từ đồng nghĩa (ví dụ AI sinh ra `"bargain, discuss, mediate"` từ route `/api/ai/generate`), hàm `JSON.parse(card.synonyms)` sẽ ném lỗi `SyntaxError` (được bọc trong try/catch nhưng tạo rác và hành vi không nhất quán).
  - Đây là biểu hiện của việc thiếu thiết kế trường dữ liệu chuyên biệt (ví dụ trường `options Json?` hoặc bảng con `CardOption`).

### 4.6 Model chết (Dead Schema Code): `Achievement`
- Khai báo tại dòng 129-138 trong `schema.prisma`.
- Tìm kiếm toàn bộ thư mục `src/`: **Không có bất kỳ dòng mã nào** tham chiếu đến `prisma.achievement`, không có API mở khóa huy hiệu, không có UI hiển thị huy hiệu, không có file seed danh mục huy hiệu.

---

## 5. RÀ SOÁT CÁC TRUY VẤN ORM, TRANSACTION & TÍNH TOÀN VẸN DỮ LIỆU

### 5.1 Race Condition & Thiếu Transaction trong Gamification (`src/lib/gamification.ts`)
Trong hàm `updateGamification`:
```typescript
// Bước 1: Đọc stats
const stats = await prisma.userStats.findUnique({ where: { userId } });

// Bước 2: Tính toán XP & Level trong bộ nhớ
const newXp = (stats?.totalXP || 0) + xpEarned;
const newLevel = calculateLevel(newXp);

// Bước 3: Cập nhật UserStats
const updatedStats = await prisma.userStats.upsert({ ... });

// Bước 4: Cập nhật DailyActivity
await prisma.dailyActivity.upsert({ ... });
```
- **Lỗi 1 (Atomicity):** `userStats.upsert` và `dailyActivity.upsert` không được bọc trong `prisma.$transaction`. Nếu cập nhật DailyActivity thất bại, dữ liệu thống kê tổng và dữ liệu ngày sẽ bị lệch.
- **Lỗi 2 (Concurrency/Stale Read):** Giá trị `newLevel` được tính từ `stats.totalXP` đọc ở Bước 1, nhưng tại Bước 3 lại dùng `{ increment: xpEarned }`. Khi user học nhanh hoặc mở nhiều tab/làm quiz song song, `level` có thể bị tính toán sai lệch so với `totalXP` thực tế.
- **Lỗi 3 (Timezone & Streak Calculation):**
  `getLocalDateString()` lấy ngày theo múi giờ cục bộ của tiến trình Node:
  ```typescript
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  ```
  Khi ứng dụng chạy trên server cloud (chạy múi giờ UTC), vào các khung giờ từ 00:00 - 06:59 sáng giờ Việt Nam (UTC+7), server vẫn tính là ngày hôm trước của UTC. Điều này gây đứt chuỗi streak của người dùng học bài vào sáng sớm hoặc tối muộn.

### 5.2 Lỗi phi nhất quán trong đếm thẻ (`cardCount`)
- Bảng `Deck` lưu trữ trường `cardCount Int @default(0)`.
- Khi thêm thẻ (`/api/decks/[id]/cards`): `data: { cardCount: { increment: 1 } }`.
- Khi xóa thẻ (`/api/cards/[id]`): `data: { cardCount: { decrement: 1 } }`.
- **Lỗ hổng:**
  - Trong `src/app/api/admin/decks/[id]/route.ts`:
    ```typescript
    await prisma.card.deleteMany({ where: { deckId: params.id } });
    await prisma.deck.delete({ where: { id: params.id } });
    ```
    Hai lệnh xóa này không nằm trong `$transaction`. Nếu lệnh xóa `deck` lỗi, các thẻ đã bị xóa vĩnh viễn nhưng deck rỗng vẫn còn.
  - Trong `DELETE /api/cards/[id]`, không có ràng buộc kiểm tra `cardCount >= 0`. Nếu có thao tác xóa trùng lặp hoặc bất đồng bộ, `cardCount` có thể bị âm.

### 5.3 Lỗ hổng Bảo mật và Xác thực trong các thao tác Database
| Endpoint | Thao tác DB | Lỗ hổng bảo mật liên quan đến DB |
|---|---|---|
| `GET /api/decks/[id]/cards` | `prisma.card.findMany({ where: { deckId: id } })` | **Hoàn toàn không kiểm tra Session & Ownership**. Bất kỳ ai cũng có thể đọc toàn bộ thẻ của bất kỳ deck nào (kể cả deck riêng tư). |
| `POST /api/decks/[id]/cards` | `prisma.card.create(...)` | **Hoàn toàn không kiểm tra Session & Ownership**. Người dùng chưa đăng nhập hoặc kẻ xấu có thể thêm thẻ bừa bãi vào deck của người khác. |
| `PUT /api/cards/[id]` | `prisma.card.update(...)` | **Hoàn toàn không kiểm tra Session & Ownership**. Bất kỳ ai cũng có thể sửa nội dung bất kỳ thẻ nào trong database. |
| `DELETE /api/cards/[id]` | `prisma.card.delete(...)` | **Hoàn toàn không kiểm tra Session & Ownership**. Bất kỳ ai cũng có thể xóa bất kỳ thẻ nào trong database. |
| `POST /api/quiz/submit` | `prisma.quizAnswer.createMany(...)` | **Tin tưởng tuyệt đối client**. Client gửi danh sách `{ isCorrect: boolean }`, server không kiểm tra lại câu trả lời với `card.back` mà trực tiếp ghi nhận điểm và cộng XP gamification vào database. |

### 5.4 Sự bất nhất trong định dạng dữ liệu trả về giữa Prisma ID và `_id`
- Do lịch sử mã nguồn có thể chuyển đổi từ MongoDB/Mongoose sang PostgreSQL/Prisma, các entity trong schema dùng `id String @id @default(cuid())`.
- Tuy nhiên, giao diện Frontend (`src/app/dashboard/page.tsx`, `src/app/decks/[id]/page.tsx`, `src/app/decks/[id]/study/page.tsx`) lại định nghĩa `interface Deck { _id: string; ... }` và `interface Card { _id: string; ... }`.
- Để đối phó, một số route handler thực hiện map thủ công:
  - `src/app/api/decks/route.ts`: `decks.map(d => ({ ...d, _id: d.id }))`
  - `src/app/api/cards/[id]/route.ts`: `{ ...card, _id: card.id }`
- Nhưng các route khác lại **quên map `_id`**:
  - `src/app/api/admin/decks/route.ts`: Chỉ trả về `id`.
  - `src/app/api/decks/import/route.ts`: Chỉ trả về `deck: { id: ... }`.
  - `src/app/api/ai/generate/route.ts`: Chỉ trả về `deck: { id: ... }`.
  Điều này dẫn đến nguy cơ các component frontend bị lỗi `undefined` khi truy cập `deck._id`.

---

## 6. KIỂM TRA LỖI BIÊN DỊCH VÀ CHE GIẤU LỖI TRONG `next.config.mjs`

### 6.1 Lỗi TypeScript TypeCheck
Khi thực thi `npx tsc --noEmit`:
```text
src/app/api/user/stats/route.ts(11,7): error TS2322: Type 'Request' is not assignable to type 'NextRequest | (IncomingMessage & { cookies: Partial<{ [key: string]: string; }>; }) | NextApiRequest'.
  Type 'Request' is missing the following properties from type 'NextRequest': cookies, geo, ip, nextUrl, and 3 more.
```
Route `/api/user/stats` nhận vào `Request` tiêu chuẩn thay vì `NextRequest`, gây lỗi kiểu dữ liệu khi truyền vào hàm `getToken`.

### 6.2 Cấu hình che giấu lỗi build trong `next.config.mjs`
Tại `next.config.mjs`:
```javascript
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};
```
Dự án đang bật `ignoreBuildErrors: true` và `ignoreDuringBuilds: true`. Đây là nguyên nhân khiến lệnh `npm run build` vượt qua được dù có lỗi TypeScript và hơn 25 lỗi ESLint vi phạm quy tắc nghiêm ngặt.

---

## 7. BẢNG TỔNG HỢP CÁC PHÁT HIỆN & ĐỀ XUẤT KHẮC PHỤC

| STT | Vấn đề phát hiện | Vị trí cụ thể | Phân loại | Giải pháp đề xuất |
|---|---|---|---|---|
| 1 | `npx prisma validate` lỗi thiếu biến môi trường | `prisma/schema.prisma:8` | Database Config | Tạo file `.env.example` chứa `DATABASE_URL` và `DIRECT_URL`. |
| 2 | Lệch pha hoàn toàn giữa Migration và Schema | `prisma/migrations/` | Migration Drift | Tạo migration mới đồng bộ toàn bộ 12 model và các cột mới (`prisma migrate dev`). |
| 3 | Lỗi gọi `$connect()` ở top-level của module | `src/lib/prisma.ts:9-18` | Performance / Build | Loại bỏ đoạn gọi `$connect()` top-level, để Prisma kết nối lazy. |
| 4 | Thuật toán SRS cập nhật thẻ dùng chung | `prisma/schema.prisma:48-52`, `api/cards/[id]/review` | Data Architecture | Tạo model `CardProgress` gắn với `(userId, cardId)` để mỗi user có tiến độ ôn tập độc lập. |
| 5 | Model `User` thiếu `createdAt`, `updatedAt` | `prisma/schema.prisma:182` | Data Modeling | Bổ sung `createdAt DateTime @default(now())` và `updatedAt DateTime @updatedAt` vào `User`. |
| 6 | `QuizAnswer` thiếu Foreign Key & Index tới `Card` | `prisma/schema.prisma:98` | Relational Integrity | Thêm relation tới `Card` với `@relation(...)` và `@@index([cardId])`. |
| 7 | Thiếu Foreign Key Index trên `Account.userId`, `Session.userId` | `prisma/schema.prisma:157, 177` | Indexing / Performance | Thêm `@@index([userId])` vào `Account` và `Session`. |
| 8 | Thiếu Composite Index ôn tập `[deckId, nextReview]` | `prisma/schema.prisma:58-60` | Query Optimization | Thêm `@@index([deckId, nextReview])` trên `Card`. |
| 9 | Thiếu Composite Index sắp xếp `[userId, updatedAt]` | `prisma/schema.prisma:31` | Query Optimization | Thêm `@@index([userId, updatedAt])` trên `Deck`. |
| 10 | Nhồi JSON options vào cột `synonyms` | `api/decks/import-ai`, `api/quiz/generate` | Schema Overloading | Bổ sung cột riêng biệt `options Json?` cho `Card`. |
| 11 | Không có session/ownership check trên thẻ | `api/cards/[id]`, `api/decks/[id]/cards` | Security / Data Loss | Thêm kiểm tra `getServerSession(authOptions)` và xác minh quyền sở hữu deck trước khi đọc/ghi/xóa thẻ. |
| 12 | Gamification updates không nằm trong transaction | `src/lib/gamification.ts:92-143` | Concurrency / Integrity | Bọc `userStats.upsert` và `dailyActivity.upsert` trong `prisma.$transaction`. |
| 13 | Không có file seed database | Toàn dự án | Tooling / DX | Xây dựng script `prisma/seed.ts` khởi tạo tài khoản admin và bộ thẻ TOEIC mẫu. |
| 14 | Model `Achievement` không được sử dụng | `prisma/schema.prisma:129-138` | Dead Code | Triển khai logic tính toán huy hiệu hoặc dọn dẹp model nếu không dùng. |
| 15 | Lỗi TypeScript `Request` tại `/api/user/stats` | `src/app/api/user/stats/route.ts:8` | TypeScript Error | Đổi kiểu tham số từ `Request` sang `NextRequest`. |
