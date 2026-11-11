# Phân Tích Kỹ Thuật Chi Tiết: Database & Prisma Hardening (Milestone 2)

**Dự án:** FlashCard (Intelligent TOEIC Learning Platform)  
**Tác giả:** Codebase Explorer M2 (`teamwork_explorer_m2_1`)  
**Ngày thực hiện:** 2026-11-10  
**Chế độ:** Read-Only Investigation  

---

## 1. TỔNG QUAN ĐIỀU TRA

Báo cáo điều tra này tập trung vào các yêu cầu cốt lõi của **Milestone 2 (Database & Prisma Hardening)**:
1. Phân tích `prisma/schema.prisma` đối với các model `User`, `Card`, `Account`, `Session`, `QuizAnswer`.
2. Phân tích truy vấn sắp xếp người dùng tại `src/app/api/admin/stats/route.ts`.
3. Rà soát toàn diện phạm vi tác động (blast radius) trên toàn bộ thư mục `src/`.
4. Đưa ra các khuyến nghị chính xác kèm mã nguồn cụ thể và phương thức xác minh độc lập.

---

## 2. PHÂN TÍCH SCHEMA PRISMA (`prisma/schema.prisma`)

### 2.1 Model `User` (Dòng 182-199)

#### Hiện trạng quan sát được
```prisma
// prisma/schema.prisma:182-199
model User {
  id             String          @id @default(cuid())
  name           String?
  username       String?         @unique
  email          String?         @unique
  emailVerified  DateTime?
  password       String?
  image          String?
  role           UserRole        @default(USER)
  accounts       Account[]
  sessions       Session[]
  decks          Deck[]
  cardReviews    CardReview[]
  quizSessions   QuizSession[]
  stats          UserStats?
  achievements   Achievement[]
  dailyActivities DailyActivity[]
}
```

#### Phân tích & Vấn đề
- **Khuyết thiếu trường mốc thời gian:** Model `User` hoàn toàn không có `createdAt` và `updatedAt`.
- **Hệ quả thực tế:**
  - Không thể xác định thời điểm người dùng đăng ký hoặc cập nhật hồ sơ.
  - Các route quản trị (`/api/admin/stats` và `/api/admin/users`) không có trường thời gian để sắp xếp người dùng mới nhất, buộc phải dùng giải pháp tạm thời `orderBy: { emailVerified: "desc" }`.
  - Mọi người dùng thông thường đăng ký qua form (`/api/auth/register`) đều có `emailVerified = null`. Khi sắp xếp theo `emailVerified`, thứ tự người dùng trong trang quản trị bị hỗn loạn, không xác định.
  - Giao diện Admin Dashboard (`src/app/admin/page.tsx:18`) đã khai báo sẵn `createdAt: string` trong interface `recentUsers`, nhưng API hiện không thể trả về giá trị này.

#### Đề xuất thay đổi
Bổ sung hai trường chuẩn:
```prisma
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
```

---

### 2.2 Model `Card` (Dòng 34-60)

#### Hiện trạng quan sát được
```prisma
// prisma/schema.prisma:34-60
model Card {
  id           String   @id @default(cuid())
  deckId       String
  front        String
  back         String
  phonetic     String   @default("")
  example      String   @default("")
  partOfSpeech String   @default("")
  synonyms     String   @default("")
  antonyms     String   @default("")
  collocations String   @default("")
  toeicPart    String   @default("")
  difficulty   String   @default("medium")
  audioUrl     String   @default("")
  easeFactor   Float    @default(2.5)
  interval     Int      @default(0)
  repetitions  Int      @default(0)
  nextReview   DateTime @default(now())
  lastReviewed DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deck         Deck     @relation(fields: [deckId], references: [id], onDelete: Cascade)
  reviews      CardReview[]

  @@index([deckId])
  @@index([nextReview])
}
```

#### Phân tích & Vấn đề
- **Chỉ mục hiện tại:** Có 2 chỉ mục đơn lẻ: `@@index([deckId])` và `@@index([nextReview])`.
- **Điểm nghẽn hiệu năng truy vấn Spaced Repetition (SRS):**
  - Truy vấn cốt lõi của tính năng ôn tập thẻ (`src/app/api/decks/[id]/study/route.ts:10-12`):
    ```typescript
    const cards = await prisma.card.findMany({
      where: { deckId: id, nextReview: { lte: new Date() } },
    });
    ```
  - Khi có hàng chục ngàn thẻ, PostgreSQL phải dùng Bitmap Index Scan kết hợp 2 chỉ mục hoặc quét index `deckId` rồi lọc từng dòng theo `nextReview`.
  - Thêm composite index `@@index([deckId, nextReview])` cho phép PostgreSQL thực hiện B-tree Index Range Scan trực tiếp với độ phức tạp $O(\log N)$, không cần lọc lại trên bảng dữ liệu.
- **Quan hệ ngược với `QuizAnswer`:**
  - Bảng `QuizAnswer` có trường `cardId String`, nhưng hiện tại `Card` chưa khai báo mảng quan hệ `quizAnswers QuizAnswer[]`.

#### Đề xuất thay đổi
```prisma
model Card {
  ...
  reviews      CardReview[]
  quizAnswers  QuizAnswer[]

  @@index([deckId])
  @@index([nextReview])
  @@index([deckId, nextReview])
}
```

---

### 2.3 Model `Account` & `Session` (Dòng 155-180)

#### Hiện trạng quan sát được
```prisma
// prisma/schema.prisma:155-180
model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?  @db.Text
  access_token       String?  @db.Text
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?  @db.Text
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### Phân tích & Vấn đề
- **Thiếu chỉ mục ngoại khóa (`userId`):**
  - Cả hai bảng `Account` và `Session` đều có quan hệ `@relation(fields: [userId], references: [id], onDelete: Cascade)`.
  - Bảng `Account` chỉ có unique index trên `[provider, providerAccountId]`.
  - Bảng `Session` chỉ có unique index trên `sessionToken`.
  - Khi xóa người dùng (`prisma.user.delete` tại `src/app/api/admin/users/[id]/route.ts:43`), PostgreSQL phải kiểm tra ràng buộc khóa ngoại và thực hiện cascade delete trên `Account` và `Session`. Do thiếu chỉ mục trên `userId`, cơ sở dữ liệu buộc phải thực hiện **Full Table Scan (Sequential Scan)** trên cả hai bảng.
  - NextAuth và Prisma khuyến nghị thêm `@@index([userId])` vào cả hai bảng để tối ưu hóa hiệu năng và tránh lock bảng.

#### Đề xuất thay đổi
- Thêm `@@index([userId])` vào model `Account`.
- Thêm `@@index([userId])` vào model `Session`.

---

### 2.4 Model `QuizAnswer` (Dòng 95-107)

#### Hiện trạng quan sát được
```prisma
// prisma/schema.prisma:95-107
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

#### Phân tích & Vấn đề
- **Thiếu Foreign Key Constraint:** Trường `cardId` là chuỗi tự do không có ràng buộc khóa ngoại `@relation` tới model `Card`.
  - Khi một thẻ (`Card`) bị xóa qua API `DELETE /api/cards/[id]`, các bản ghi `QuizAnswer` liên quan sẽ trở thành các bản ghi mồ côi (dangling records) lưu trữ `cardId` không còn tồn tại.
- **Thiếu Index trên `cardId`:** Chỉ có `@@index([quizSessionId])`. Khi truy vấn lịch sử trả lời của một thẻ (để tính tỷ lệ làm đúng của câu hỏi hoặc phát hiện câu hỏi khó), hệ thống phải quét toàn bộ bảng `QuizAnswer`.
- **Ràng buộc Cascade Delete:** Việc thiết lập `card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)` đảm bảo tính nhất quán dữ liệu, hoàn toàn phù hợp với cấu trúc toàn dự án (toàn bộ 11 quan hệ còn lại trong `schema.prisma` đều dùng `onDelete: Cascade`).

#### Đề xuất thay đổi
```prisma
model QuizAnswer {
  id            String      @id @default(cuid())
  quizSessionId String
  cardId        String
  userAnswer    String
  correctAnswer String
  isCorrect     Boolean
  timeSpentMs   Int         @default(0)
  createdAt     DateTime    @default(now())
  quizSession   QuizSession @relation(fields: [quizSessionId], references: [id], onDelete: Cascade)
  card          Card        @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@index([quizSessionId])
  @@index([cardId])
}
```

---

## 3. PHÂN TÍCH `src/app/api/admin/stats/route.ts`

### 3.1 Đoạn mã hiện tại (Dòng 32-46)
```typescript
      prisma.user.findMany({
        take: 10,
        orderBy: { emailVerified: "desc" },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          emailVerified: true,
          _count: {
            select: { decks: true },
          },
        },
      }),
```

### 3.2 Phân tích lỗi logic và tính tương thích với Frontend
1. **Lỗi logic sắp xếp:** Sắp xếp theo `emailVerified: "desc"` là một giải pháp tình thế do model `User` trước đó không có trường `createdAt`.
   - Người dùng đăng ký bằng tài khoản nội bộ (username/password) có `emailVerified = null`.
   - Khi đó, các người dùng mới đăng ký không bao giờ xuất hiện ở đầu danh sách "Người dùng gần đây", gây hiểu lầm trên dashboard quản trị.
2. **Khuyết thiếu dữ liệu trả về cho Frontend:**
   - Trong `src/app/admin/page.tsx` (dòng 12-20):
     ```typescript
     interface DashboardStats {
       ...
       recentUsers: {
         id: string;
         name: string | null;
         username: string | null;
         email: string | null;
         role: string;
         createdAt: string;
         _count: { decks: number };
       }[];
       ...
     }
     ```
   - Frontend rõ ràng mong đợi trường `createdAt: string`. Do route handler hiện tại chỉ select `emailVerified: true` mà không select `createdAt: true`, trường này bị `undefined` ở phía client.

### 3.3 Đề xuất chỉnh sửa chính xác
Thay thế `orderBy: { emailVerified: "desc" }` bằng `orderBy: { createdAt: "desc" }`, đồng thời bổ sung `createdAt: true` vào khối `select`:
```typescript
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          emailVerified: true,
          _count: {
            select: { decks: true },
          },
        },
      }),
```

---

## 4. RÀ SOÁT TÁC ĐỘNG TOÀN DIỆN (BLAST RADIUS ACROSS `src/`)

Qua rà soát bằng công cụ tìm kiếm trên toàn bộ mã nguồn `src/`, kết quả kiểm tra các vị trí bị ảnh hưởng hoặc liên quan như sau:

| Tệp tin | Vị trí / Lệnh | Hiện trạng | Phân tích tác động sau khi đổi Schema |
|---|---|---|---|
| `src/app/api/admin/users/route.ts` | Dòng 20-33 | `orderBy: { emailVerified: "desc" }`, `select: { ..., emailVerified: true }` | **Cần cập nhật đồng bộ**: Giống như route stats, danh sách quản lý user tại trang Admin (`/admin/users`) đang bị sắp xếp sai do dùng `emailVerified`. Khuyến nghị đổi sang `orderBy: { createdAt: "desc" }` và thêm `createdAt: true`. |
| `src/app/admin/page.tsx` | Dòng 18 | `createdAt: string` trong interface `recentUsers` | **Khắc phục lỗi tiềm ẩn**: Khi API stats trả về `createdAt`, dữ liệu sẽ khớp hoàn toàn với định nghĩa kiểu TypeScript. |
| `src/app/admin/users/page.tsx` | Dòng 15 | `emailVerified: string \| null` trong interface `AdminUser` | Không xung đột. Nếu thêm `createdAt`, trang quản lý user có thể hiển thị ngày tạo tài khoản. |
| `src/app/api/auth/register/route.ts` | Dòng 38-44 | `prisma.user.create({ data: { name, username, password } })` | **Tự động tương thích**: Prisma tự động điền `createdAt` (`now()`) và `updatedAt` (`now()`). Không cần sửa code. |
| `src/app/api/auth/change-password/route.ts` | Dòng 60 | `prisma.user.update(...)` | **Tự động tương thích**: Prisma tự động cập nhật `updatedAt`. |
| `src/app/api/admin/users/[id]/role/route.ts` | Dòng 39 | `prisma.user.update(...)` | **Tự động tương thích**: Prisma tự động cập nhật `updatedAt`. |
| `src/lib/auth.ts` | Dòng 10 | `adapter: PrismaAdapter(prisma)` | **Tương thích 100%**: NextAuth PrismaAdapter hỗ trợ các trường mở rộng trên `User`. Việc bổ sung `createdAt` và `updatedAt` là chuẩn mực của NextAuth. |
| `src/app/api/decks/[id]/study/route.ts` | Dòng 10-12 | `where: { deckId: id, nextReview: { lte: new Date() } }` | **Tăng tốc hiệu năng trực tiếp**: Tận dụng triệt để composite index `@@index([deckId, nextReview])`. |
| `src/app/api/decks/[id]/cards/route.ts` | Dòng 10-13, 41-55 | `findMany({ where: { deckId } })`, `card.create` | Hoạt động bình thường; tận dụng prefix index của composite index. |
| `src/app/api/cards/[id]/route.ts` | Dòng 53 | `prisma.card.delete({ where: { id } })` | **Bảo vệ toàn vẹn dữ liệu**: Khi xóa thẻ, cascade delete sẽ tự động dọn dẹp các bản ghi `QuizAnswer` tương ứng, loại bỏ bản ghi mồ côi. |
| `src/app/api/quiz/submit/route.ts` | Dòng 43-56 | `prisma.quizAnswer.createMany({ data: answerData })` | **Tương thích 100%**: `answerData` đã có sẵn trường scalar `cardId: a.cardId`. Ràng buộc khóa ngoại mới đảm bảo `cardId` hợp lệ. |

---

## 5. MÃ NGUỒN ĐỀ XUẤT CHÍNH XÁC (PROPOSED CHANGES)

### 5.1 Toàn văn Schema mới (`prisma/schema.prisma`)
Tệp đầy đủ đã được kiểm chứng và lưu tại:  
`.agents/teamwork/teamwork_explorer_m2_1/proposed_schema.prisma`

### 5.2 Patch hợp nhất (`schema_and_route.patch`)
Đã lưu tại:  
`.agents/teamwork/teamwork_explorer_m2_1/schema_and_route.patch`

---

## 6. PHƯƠNG THỨC XÁC MINH ĐỘC LẬP (VERIFICATION METHOD)

1. **Kiểm tra tính hợp lệ của Prisma Schema:**
   ```powershell
   $env:DATABASE_URL="postgresql://test:test@localhost:5432/test"
   $env:DIRECT_URL="postgresql://test:test@localhost:5432/test"
   node node_modules/prisma/build/index.js validate --schema=.agents/teamwork/teamwork_explorer_m2_1/proposed_schema.prisma
   ```
   *Kết quả thực tế đã kiểm chứng:*  
   `The schema at .agents\teamwork\teamwork_explorer_m2_1\proposed_schema.prisma is valid 🚀` (Exit code: 0).

2. **Kiểm tra chuẩn định dạng Prisma:**
   ```powershell
   node node_modules/prisma/build/index.js format --check --schema=.agents/teamwork/teamwork_explorer_m2_1/proposed_schema.prisma
   ```
   *Kết quả thực tế đã kiểm chứng:*  
   `All files are formatted correctly!` (Exit code: 0).

3. **Kiểm tra kiểu dữ liệu TypeScript sau khi cập nhật:**
   ```powershell
   npx tsc --noEmit
   ```
   Đảm bảo không phát sinh lỗi kiểu dữ liệu liên quan đến `createdAt` hay `recentUsers`.
