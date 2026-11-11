# BÁO CÁO RÀ SOÁT TOÀN DIỆN HỆ THỐNG FLASHCARD (SURVEY REPORT)
**Mã khảo sát:** EXPLORER-SURVEY-03  
**Ngày thực hiện:** 2026-11-10  
**Thư mục làm việc:** `e:\GitHub\FlashCard`  
**Mục tiêu:** Rà soát kiến trúc, định tuyến, phân quyền/xác thực, các lỗ hổng bảo mật (IDOR, Auth bypass), tính đúng đắn của logic nghiệp vụ (Spaced Repetition SM-2, Quiz, Gamification), xử lý lỗi và các rủi ro vận hành.

---

## 1. TỔNG QUAN HỆ THỐNG & TECH STACK

Dự án FlashCard là ứng dụng học từ vựng (định hướng TOEIC) xây dựng trên nền tảng:
- **Next.js 14.2.35 (App Router)** với TypeScript 5.
- **Prisma ORM 5.22.0** kết nối cơ sở dữ liệu PostgreSQL (Supabase).
- **NextAuth.js 4.24.14** sử dụng chiến lược JWT session, hỗ trợ Credentials Provider và Google OAuth Provider.
- **Google Generative AI SDK (`@google/generative-ai` 0.24.1)** gọi model `gemini-2.5-flash` để sinh thẻ tự động từ chủ đề hoặc trích xuất từ tài liệu (PDF, hình ảnh, văn bản).
- **Tailwind CSS 3.4.1**, **Recharts 3.8.1** cho biểu đồ phân tích học tập, **Canvas Confetti** cho hiệu ứng gamification.

---

## 2. BẢNG DANH MỤC ĐỊNH TUYẾN & ĐIỂM CUỐI (ROUTING INVENTORY)

### 2.1. Client Pages & Layouts (`src/app/`)
| Tuyến đường (Route) | File | Quyền truy cập mục tiêu | Đánh giá bảo vệ hiện tại |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Công khai (Public) | Nếu đã login, Middleware tự redirect về `/dashboard` |
| `/login` | `src/app/login/page.tsx` | Khách (Guest) | Middleware redirect về `/dashboard` nếu đã login |
| `/register` | `src/app/register/page.tsx` | Khách (Guest) | Middleware redirect về `/dashboard` nếu đã login |
| `/dashboard` | `src/app/dashboard/page.tsx` | Người dùng đã login | Được Middleware bảo vệ |
| `/decks/[id]` | `src/app/decks/[id]/page.tsx` | Chủ sở hữu bộ thẻ | Middleware chặn unauthenticated, nhưng không kiểm tra quyền sở hữu client-side |
| `/decks/[id]/study` | `src/app/decks/[id]/study/page.tsx` | Người dùng đã login | Được Middleware bảo vệ |
| `/decks/[id]/quiz` | `src/app/decks/[id]/quiz/page.tsx` | Người dùng đã login | Được Middleware bảo vệ |
| `/decks/[id]/quiz/[type]` | `src/app/decks/[id]/quiz/[type]/page.tsx` | Người dùng đã login | Được Middleware bảo vệ |
| `/profile` | `src/app/profile/page.tsx` | Người dùng đã login | **THIẾU TRONG MIDDLEWARE MATCHER**: Chỉ kiểm tra `useSession` phía client |
| `/admin` | `src/app/admin/page.tsx` | ADMIN | Được Middleware và layout kiểm tra vai trò ADMIN |
| `/admin/login` | `src/app/admin/login/page.tsx` | Khách / Admin login | Cho phép đăng nhập riêng cho Admin |
| `/admin/users` | `src/app/admin/users/page.tsx` | ADMIN | Được bảo vệ bởi Middleware và role check |
| `/admin/decks` | `src/app/admin/decks/page.tsx` | ADMIN | Được bảo vệ bởi Middleware và role check |

### 2.2. API Routes (`src/app/api/`)
| Endpoint | Phương thức | Xử lý file | Quyền hạn yêu cầu | Đánh giá thực tế |
|---|---|---|---|---|
| `/api/auth/[...nextauth]` | ALL | `src/app/api/auth/[...nextauth]/route.ts` | Công khai | NextAuth handler |
| `/api/auth/register` | POST | `src/app/api/auth/register/route.ts` | Công khai | Tạo user mới, thiếu validate độ mạnh mật khẩu |
| `/api/auth/change-password` | GET, POST | `src/app/api/auth/change-password/route.ts` | Authenticated | Kiểm tra `session.user.id`, thiếu rate limit |
| `/api/decks` | GET, POST | `src/app/api/decks/route.ts` | Authenticated | Có `getServerSession`, lọc theo `userId: session.user.id` |
| `/api/decks/[id]` | GET, PUT, DELETE | `src/app/api/decks/[id]/route.ts` | Deck Owner | Có kiểm tra `deck.userId === session.user.id` |
| `/api/decks/[id]/cards` | GET, POST | `src/app/api/decks/[id]/cards/route.ts` | Deck Owner | **LỖI NGHIÊM TRỌNG (IDOR)**: Hoàn toàn không kiểm tra quyền sở hữu deck |
| `/api/decks/[id]/study` | GET | `src/app/api/decks/[id]/study/route.ts` | Deck Owner | **LỖI IDOR**: Không kiểm tra `userId`, đọc thẻ của bất kỳ deck nào |
| `/api/decks/import` | POST | `src/app/api/decks/import/route.ts` | Authenticated | Gán `userId: session.user.id` |
| `/api/decks/import-ai` | POST | `src/app/api/decks/import-ai/route.ts` | Authenticated | Gán `userId: session.user.id` |
| `/api/cards/[id]` | PUT, DELETE | `src/app/api/cards/[id]/route.ts` | Card Owner | **CỰC KỲ NGUY HIỂM**: KHÔNG CÓ AUTH, KHÔNG CÓ CHECK OWNERSHIP |
| `/api/cards/[id]/review` | POST | `src/app/api/cards/[id]/review/route.ts` | Card Owner | **CỰC KỲ NGUY HIỂM**: Cho phép unauthenticated, không check ownership |
| `/api/quiz/generate` | POST | `src/app/api/quiz/generate/route.ts` | Authenticated | **LỖI IDOR & LỘ ĐÁP ÁN**: Tạo quiz trên deck bất kỳ; trả về `correctAnswer` và `isCorrect` |
| `/api/quiz/submit` | POST | `src/app/api/quiz/submit/route.ts` | Session Owner | **LỖI GIAN LẬN & INFINITE XP**: Tin cậy `isCorrect` từ client; submit lại nhiều lần |
| `/api/user/stats` | GET | `src/app/api/user/stats/route.ts` | Authenticated | Lỗi type `Request` vs `NextRequest` (TS2322) |
| `/api/user/analytics` | GET | `src/app/api/user/analytics/route.ts` | Authenticated | Hoạt động tốt với `session.user.id` |
| `/api/ai/generate` | POST | `src/app/api/ai/generate/route.ts` | Authenticated | Không giới hạn `cardCount`, không rate limit |
| `/api/admin/stats` | GET | `src/app/api/admin/stats/route.ts` | ADMIN | Kiểm tra role ADMIN |
| `/api/admin/users` | GET | `src/app/api/admin/users/route.ts` | ADMIN | Kiểm tra role ADMIN, sort sai do thiếu `createdAt` |
| `/api/admin/users/[id]` | DELETE | `src/app/api/admin/users/[id]/route.ts` | ADMIN | Kiểm tra role ADMIN, chống xóa chính mình |
| `/api/admin/users/[id]/role` | PATCH | `src/app/api/admin/users/[id]/role/route.ts` | ADMIN | Kiểm tra role ADMIN, chống tự hạ quyền |
| `/api/admin/decks` | GET | `src/app/api/admin/decks/route.ts` | ADMIN | Kiểm tra role ADMIN |
| `/api/admin/decks/[id]` | DELETE | `src/app/api/admin/decks/[id]/route.ts` | ADMIN | Kiểm tra role ADMIN |

---

## 3. KIỂM TOÁN LỖ HỔNG BẢO MẬT & PHÂN QUYỀN (SECURITY AUDIT)

### Lỗ hổng 1: Không xác thực & IDOR nghiêm trọng tại CRUD Card (`/api/cards/[id]`)
- **Vị trí quan sát:** `src/app/api/cards/[id]/route.ts:4-37` (PUT) và `40-67` (DELETE), kết hợp với `src/middleware.ts:61-72`.
- **Phân tích chi tiết:**
  1. Trong `src/middleware.ts`, matcher chỉ lọc:
     ```typescript
     matcher: [
       "/", "/login", "/register", "/dashboard/:path*",
       "/admin/:path*", "/decks/:path*", "/api/decks/:path*", "/api/admin/:path*"
     ]
     ```
     Đường dẫn `/api/cards/:path*` hoàn toàn **không nằm trong matcher** của Middleware.
  2. Trong cả hai hàm `PUT` và `DELETE` của `src/app/api/cards/[id]/route.ts`, không hề có dòng lệnh gọi `getServerSession(authOptions)`.
  3. Không có bất kỳ câu truy vấn nào kiểm tra xem thẻ đó thuộc về deck nào và deck đó có phải của người dùng đang đăng nhập hay không:
     ```typescript
     export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
       const { id } = params;
       const card = await prisma.card.findUnique({ where: { id } });
       if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
       await prisma.$transaction([
         prisma.card.delete({ where: { id } }),
         prisma.deck.update({ where: { id: card.deckId }, data: { cardCount: { decrement: 1 } } }),
       ]);
       return NextResponse.json({ success: true });
     }
     ```
- **Hậu quả:** Bất kỳ kẻ tấn công nặc danh nào trên Internet cũng có thể gửi `DELETE /api/cards/<id>` hoặc `PUT /api/cards/<id>` để xóa sạch hoặc sửa đổi nội dung thẻ học của mọi người dùng trong cơ sở dữ liệu.

---

### Lỗ hổng 2: IDOR khi thêm thẻ và xem danh sách thẻ trong bộ (`/api/decks/[id]/cards`)
- **Vị trí quan sát:** `src/app/api/decks/[id]/cards/route.ts:4-22` (GET) và `24-69` (POST).
- **Phân tích chi tiết:**
  - Middleware yêu cầu người dùng phải đăng nhập để vào `/api/decks/:path*`.
  - Tuy nhiên, khi User A (kẻ tấn công) đã đăng nhập, User A có thể gửi yêu cầu `POST /api/decks/{deckId_cua_User_B}/cards` hoặc `GET /api/decks/{deckId_cua_User_B}/cards`.
  - Endpoint `POST` trực tiếp chạy:
    ```typescript
    prisma.card.create({ data: { deckId: id, front, back, ... } })
    prisma.deck.update({ where: { id }, data: { cardCount: { increment: 1 } } })
    ```
    Không có bước `prisma.deck.findFirst({ where: { id, userId: session.user.id } })`.
- **Hậu quả:** Bất kỳ người dùng đã đăng nhập nào cũng có thể đọc trộm toàn bộ thẻ học riêng tư hoặc chèn hàng loạt thẻ rác vào bộ thẻ của người dùng khác.

---

### Lỗ hổng 3: Can thiệp thuật toán SM-2 & Đánh giá thẻ trái phép (`/api/cards/[id]/review`)
- **Vị trí quan sát:** `src/app/api/cards/[id]/review/route.ts:7-83`.
- **Phân tích chi tiết:**
  - Route này không nằm trong Middleware matcher.
  - Endpoint cho phép thực thi ngay cả khi không có phiên đăng nhập:
    ```typescript
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    // Vẫn cập nhật Card dù userId là undefined!
    const updatedCard = await prisma.card.update({
      where: { id },
      data: { easeFactor: result.easeFactor, interval: result.interval, ... }
    });
    ```
  - Thẻ được lưu trực tiếp trạng thái `interval`, `easeFactor`, `nextReview` trên chính bảng `Card`. Khi bị gọi trái phép, chu kỳ ôn tập của chủ sở hữu thẻ sẽ bị xáo trộn hoàn toàn.

---

### Lỗ hổng 4: Lộ toàn bộ đáp án trắc nghiệm về Client (`/api/quiz/generate`)
- **Vị trí quan sát:** `src/app/api/quiz/generate/route.ts:60-98, 103-114, 142-152`.
- **Phân tích chi tiết:**
  - Khi tạo quiz, server gửi trực tiếp cờ `isCorrect: boolean` cho từng phương án trong mảng `options`:
    ```typescript
    options = [
      { text: card.back, isCorrect: true },
      ...wrongOptions.map((w) => ({ text: w.back, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);
    ```
  - Đồng thời gửi luôn `correctAnswer: card.back`.
- **Hậu quả:** Học viên chỉ cần mở tab Network trong DevTools hoặc xem biến Javascript trên trình duyệt là thấy 100% đáp án đúng trước khi làm bài.

---

### Lỗ hổng 5: Máy chủ tin cậy Client về kết quả chấm điểm & Lỗi gian lận XP vô hạn (`/api/quiz/submit`)
- **Vị trí quan sát:** `src/app/api/quiz/submit/route.ts:33-72`.
- **Phân tích chi tiết:**
  1. Khi người dùng nộp bài quiz, Client gửi mảng `answers` lên:
     ```typescript
     const answerData = answers.map((a: { isCorrect: boolean; ... }) => {
       if (a.isCorrect) correctCount++;
       else wrongCount++;
       return { ... };
     });
     ```
     Server **hoàn toàn không đối chiếu** `userAnswer` với đáp án thực trong DB mà lấy trực tiếp cờ `a.isCorrect` từ client gửi lên!
  2. Server không kiểm tra xem `quizSession.completedAt` đã có giá trị hay chưa. Người dùng có thể dùng Postman hoặc fetch loop gửi lại request nộp bài đó 1000 lần cho cùng một `sessionId`. Mỗi lần gửi, hàm `addQuizActivity()` lại được gọi và cộng thêm hàng ngàn XP vào tài khoản.

---

### Lỗ hổng 6: DoS & Tràn tài nguyên gọi AI (`/api/ai/generate` và `/api/decks/import-ai`)
- **Vị trí quan sát:** `src/app/api/ai/generate/route.ts:20-32` và `src/app/api/decks/import-ai/route.ts:127-133`.
- **Phân tích chi tiết:**
  - `cardCount` được lấy trực tiếp từ `req.json()` mà không giới hạn biên (không clamp `Math.min(cardCount, 50)`). Người dùng có thể truyền `cardCount: 999999`.
  - Không có cơ chế Rate Limiting (chống spam) đối với các endpoint gọi Google Gemini API (`gemini-2.5-flash`), dẫn đến nguy cơ cạn kiệt Quota API hoặc phát sinh chi phí lớn.

---

### Lỗ hổng 7: Thiếu bảo vệ Middleware trên trang Profile (`/profile`)
- **Vị trí quan sát:** `src/middleware.ts:61-72`.
- **Phân tích chi tiết:**
  - `matcher` của Middleware bao gồm:
    ```typescript
    matcher: [
      "/", "/login", "/register", "/dashboard/:path*",
      "/admin/:path*", "/decks/:path*", "/api/decks/:path*", "/api/admin/:path*"
    ]
    ```
  - Tuyến đường `/profile` và `/profile/:path*` không được khai báo. Người dùng chưa đăng nhập khi truy cập `/profile` sẽ tải mã trang trước khi mã client-side kịp nhận biết `status === 'unauthenticated'` để chuyển hướng.

---

## 4. TÍNH ĐÚNG ĐẮN VỀ CHỨC NĂNG & LOGIC NGHIỆP VỤ

### 4.1. Thuật toán Lặp lại Ngắt quãng (Spaced Repetition SM-2)
- **Vị trí:** `src/lib/sm2.ts:14-55` và `src/app/decks/[id]/study/page.tsx:127-147`.
- **Vấn đề cấu trúc dữ liệu:**
  - Trong `schema.prisma`, các trường SM-2 gồm: `easeFactor`, `interval`, `repetitions`, `nextReview`, `lastReviewed` được đặt trực tiếp trong Model `Card`.
  - Khi người dùng học, `nextReview` được cập nhật vào chính bản ghi `Card`. Nếu có tính năng bộ thẻ công khai (Public Decks) hoặc nhiều người cùng học 1 bộ thẻ, tiến trình học của người này sẽ ghi đè lên chu kỳ ôn tập của người khác.
- **Vấn đề tại trang học (`study/page.tsx`):**
  - Tại dòng 128-130, trang học gọi `/api/decks/${deckId}/cards` để lấy toàn bộ thẻ, thay vì gọi `/api/decks/${deckId}/study` (vốn lọc các thẻ đến hạn: `nextReview: { lte: new Date() }`).
  - Hậu quả: Dù thẻ chưa đến hạn ôn tập, mỗi lần vào trang học, toàn bộ thẻ trong bộ đều bị xáo trộn và bắt học lại từ đầu. Endpoint `/api/decks/[id]/study/route.ts` trở thành "dead code".
  - Khi người dùng đánh giá thẻ mức 0-2 (Again/Hard - quên thẻ), SM-2 gán `newInterval = 1` (ngày mai mới học lại). Trong phiên học hiện tại, thẻ đó không được đưa lại vào hàng đợi cuối phiên để học lại ngay (như hành vi chuẩn của Anki/SuperMemo).

### 4.2. Quá tải trường dữ liệu (Field Hijacking / Overloading)
- **Vị trí:** `src/app/api/decks/import-ai/route.ts:272` và `src/app/api/quiz/generate/route.ts:62-80`.
- **Quan sát:**
  - Trong `import-ai`: Khi tài liệu trích xuất là câu hỏi trắc nghiệm có 4 đáp án, mảng `options` được chuyển thành JSON string và lưu vào cột `synonyms` của bảng `Card`:
    ```typescript
    synonyms: card.options && card.options.length > 0 ? JSON.stringify(card.options.map(opt => opt.trim())) : ""
    ```
  - Trong `quiz/generate`: Code cố gắng `JSON.parse(card.synonyms)` để trích xuất phương án trắc nghiệm. Nếu từ vựng có trường đồng nghĩa dạng văn bản thuần thông thường (ví dụ: `"bargain, discuss, mediate"`), lệnh `JSON.parse` sẽ ném ngoại lệ cú pháp `SyntaxError`. Đoạn code đã bọc `try...catch` để nuốt lỗi, nhưng đây là giải pháp chắp vá (anti-pattern).

### 4.3. Race Condition & Concurrency trong Gamification
- **Vị trí:** `src/lib/gamification.ts:58-121`.
- **Quan sát:**
  - Hàm `updateGamification()` đọc `const stats = await prisma.userStats.findUnique({ where: { userId } })`.
  - Sau đó tính: `const newXp = (stats?.totalXP || 0) + xpEarned; const newLevel = calculateLevel(newXp);`.
  - Tiếp theo gọi `prisma.userStats.upsert()` với `totalXP: { increment: xpEarned }` nhưng `level: newLevel`.
  - Nếu hai thẻ được đánh giá liên tiếp hoặc người dùng học trên 2 tab song song cùng thời điểm (concurrent requests), `newLevel` được tính từ snapshot cũ có thể ghi đè làm sai lệch cấp độ level thực tế.

---

## 5. KIỂM TOÁN TÍNH ỔN ĐỊNH, LỖI BIÊN DỊCH & LINTING (COMPILER & RUNTIME RISKS)

### 5.1. Lỗi cấu hình Prisma Schema (`npx prisma validate`)
- **Lỗi quan sát được:**
  ```
  Error: Prisma schema validation - (get-config wasm)
  Error code: P1012
  error: Environment variable not found: DIRECT_URL.
    -->  prisma\schema.prisma:8
     | 
   7 |   url       = env("DATABASE_URL")
   8 |   directUrl = env("DIRECT_URL")
  ```
- **Nguyên nhân:** Dự án không có file `.env` hoặc `.env.example` ở thư mục gốc. Khi chạy công cụ xác thực schema của Prisma mà thiếu biến môi trường `DIRECT_URL`, tiến trình bị dừng ngay lập tức.
- **Lệch pha Migration:** Thư mục `prisma/migrations` chỉ có 1 migration cũ `20260424102124_add_user_role`. Các bảng quan trọng như `CardReview`, `QuizSession`, `QuizAnswer`, `UserStats`, `Achievement`, `DailyActivity` hoàn toàn chưa có file migration tương ứng.

### 5.2. Lỗi biên dịch TypeScript (`npx tsc --noEmit`)
- **Lỗi thực tế:**
  ```
  src/app/api/user/stats/route.ts(11,7): error TS2322: Type 'Request' is not assignable to type 'NextRequest | (IncomingMessage & { cookies: Partial<{ [key: string]: string; }>; }) | NextApiRequest'.
    Type 'Request' is missing the following properties from type 'NextRequest': cookies, geo, ip, nextUrl, and 3 more.
  ```
- **Nguyên nhân:** `src/app/api/user/stats/route.ts:8` khai báo `export async function GET(request: Request)`. Hàm `getToken` của NextAuth nhận `req: NextRequest`. Do sai kiểu dữ liệu giữa Web API chuẩn (`Request`) và Next.js API (`NextRequest`), TypeScript báo lỗi nghiêm trọng.
- **Rủi ro che giấu:** Trong `next.config.mjs:8-12`, lập trình viên đã đặt `typescript: { ignoreBuildErrors: true }` để "lách" lỗi biên dịch khi build.

### 5.3. Vi phạm ESLint (`npm run lint`: 31 Errors, 5 Warnings)
Trong `next.config.mjs:3-7`, `eslint: { ignoreDuringBuilds: true }` cũng đang được bật để che giấu 36 lỗi linting:
1. **Biến khai báo không sử dụng (`@typescript-eslint/no-unused-vars`):**
   - `src/app/admin/layout.tsx:7, 42`: `useEffect`, `router`.
   - `src/app/api/auth/change-password/route.ts:7, 18`: `req`, `error`.
   - `src/app/api/quiz/generate/route.ts:78`: `e`.
   - `src/components/DashboardStats.tsx:43`: `session`.
   - `src/components/UserStatsDisplay.tsx:15, 36, 58`: `session`, `updatedStats`, `e`.
2. **Sử dụng kiểu `any` (`@typescript-eslint/no-explicit-any`):**
   - 17 vị trí trên các file API routes, component và lib (`import-ai`, `import`, `ai/generate`, `profile`, `register`, `studyAudio`).
3. **Cảnh báo React Hooks (`react-hooks/exhaustive-deps`):**
   - `src/app/dashboard/page.tsx:63`: thiếu `fetchDecks`.
   - `src/app/decks/[id]/quiz/[type]/page.tsx:79`: thiếu `startTimer`.
   - `src/app/decks/[id]/study/page.tsx:185`: thiếu `handleRating`.
4. **Cảnh báo Export ẩn danh (`import/no-anonymous-default-export`):**
   - `src/lib/studyAudio.ts:83`: `export default {}`.
5. **Cảnh báo phần tử hình ảnh (`@next/next/no-img-element`):**
   - `src/components/UserAvatar.tsx:26`: dùng `<img>` thay vì `<Image />`.

### 5.4. Sắp xếp User trong Admin bị lỗi do thiếu trường `createdAt`
- **Vị trí:** `src/app/api/admin/stats/route.ts:34` và `src/app/api/admin/users/route.ts:21`.
- **Nguyên nhân:** Bảng `User` trong `schema.prisma` không có trường `createdAt`. Mã nguồn đang phải dùng giải pháp tạm bợ: `orderBy: { emailVerified: "desc" }`.
- **Hậu quả:** Đối với các tài khoản đăng ký bằng tên đăng nhập/mật khẩu thông thường (Credentials), `emailVerified` luôn là `null`. Do đó, danh sách người dùng mới nhất hiển thị trên Admin Dashboard bị sai thứ tự hoàn toàn.

---

## 6. MA TRẬN ĐÁNH GIÁ NGUY CƠ & RỦI RO (RISK MATRIX)

| Mã lỗi | Mô tả | Mức độ nghiêm trọng | Khả năng xảy ra | Tác động |
|---|---|---|---|---|
| **SEC-01** | Unauthenticated CRUD trên `/api/cards/[id]` | **CRITICAL** | Rất cao | Mọi kẻ tấn công có thể xóa sạch hoặc phá hủy thẻ học |
| **SEC-02** | IDOR trên `/api/decks/[id]/cards` | **HIGH** | Rất cao | Đọc trộm thẻ riêng tư, chèn thẻ giả mạo |
| **SEC-03** | Lộ đáp án Quiz và Client tự chấm điểm `/api/quiz/submit` | **HIGH** | Cao | Phá vỡ tính trung thực của bài thi, gian lận XP vô hạn |
| **SEC-04** | DoS & Tràn quota AI trên `/api/ai/generate` | **HIGH** | Trung bình | Tê liệt hệ thống AI, phát sinh chi phí lớn |
| **BUILD-01** | Lỗi TypeScript `TS2322` tại `user/stats/route.ts` | **HIGH** | Chắc chắn | `npx tsc --noEmit` thất bại nếu bỏ ignore |
| **BUILD-02** | Lỗi Prisma `DIRECT_URL` thiếu cấu hình | **HIGH** | Chắc chắn | `npx prisma validate` thất bại khi thiếu env |
| **LINT-01** | 31 lỗi ESLint và 5 cảnh báo | **MEDIUM** | Chắc chắn | `npm run lint` thất bại |
| **LOGIC-01**| Trang học nạp toàn bộ thẻ thay vì lọc thẻ đến hạn | **MEDIUM** | Cao | Sai lệch trải nghiệm Spaced Repetition |
| **DATA-01** | Model `User` thiếu `createdAt`, `updatedAt` | **LOW** | Thường trực | Sai thứ tự hiển thị danh sách người dùng Admin |

---

## 7. ĐỀ XUẤT GIẢI PHÁP & KẾ HOẠCH HÀNH ĐỘNG CHO ĐỘI NGŨ THI CÔNG

1. **Khắc phục lỗi bảo mật & phân quyền:**
   - Cập nhật `src/middleware.ts`: Bổ sung `/api/cards/:path*`, `/api/quiz/:path*`, `/api/user/:path*`, `/profile/:path*` vào `matcher`.
   - Trong `src/app/api/cards/[id]/route.ts`: Thêm kiểm tra `getServerSession`. Xác thực người dùng thông qua quan hệ `card.deck.userId === session.user.id`.
   - Trong `src/app/api/decks/[id]/cards/route.ts`: Kiểm tra `deck.userId === session.user.id` trước khi trả về thẻ hoặc thêm thẻ mới.
   - Trong `src/app/api/quiz/generate/route.ts`: Không trả về `correctAnswer` và `isCorrect` về client trong danh sách câu hỏi.
   - Trong `src/app/api/quiz/submit/route.ts`: Chấm điểm trực tiếp trên Server bằng cách truy vấn đáp án từ bảng `Card`. Đánh dấu `quizSession.completedAt` và chặn nộp lại lần thứ 2.
   - Trong `src/app/api/ai/generate/route.ts`: Ràng buộc `cardCount = Math.max(1, Math.min(Number(cardCount) || 10, 30))`.

2. **Khắc phục lỗi biên dịch & linting:**
   - Sửa tham số `request: Request` thành `request: NextRequest` trong `src/app/api/user/stats/route.ts`.
   - Làm sạch toàn bộ 31 lỗi ESLint (`no-unused-vars`, `no-explicit-any`, hook dependencies).
   - Tắt hai cờ bỏ qua lỗi trong `next.config.mjs` (`ignoreBuildErrors: false`, `ignoreDuringBuilds: false`) để bảo đảm chất lượng mã nguồn đạt chuẩn nghiêm ngặt của dự án.

3. **Khắc phục cấu hình cơ sở dữ liệu & Prisma:**
   - Tạo file `.env.example` chứa các biến cần thiết: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GEMINI_API_KEY`.
   - Bổ sung `createdAt DateTime @default(now())` và `updatedAt DateTime @updatedAt` vào model `User` trong `prisma/schema.prisma`.

---
*Báo cáo được hoàn thành bởi Explorer 3 - Tuân thủ tuyệt đối quy tắc Integrity và Read-only Investigation.*
