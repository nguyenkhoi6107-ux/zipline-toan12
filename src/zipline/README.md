# Zip Line Thoát Hồ Ly – Phương trình đường thẳng (Toán 12)

Game web luyện **viết phương trình tham số của đường thẳng AB trong Oxyz** và **tìm cao độ z của
điểm M trên AB**. Học sinh mỗi em một máy, giáo viên chiếu bảng xếp hạng sống.
Game là HTML/JS thuần, không cần build. Firebase Realtime Database dùng cho phòng chơi.

## Chạy thử ngay (không cần Firebase)

```bash
cd src/zipline
python3 -m http.server 8080
```

Mở <http://localhost:8080>:

| Muốn thử | Mở |
|---|---|
| Luyện tập một mình | `play.html?mode=solo` |
| Giáo viên tạo phòng (thử cục bộ) | `teacher.html?local=1` |
| Học sinh vào phòng (thử cục bộ) | `index.html?local=1`, nhập mã phòng và tên |

> Chế độ **thử cục bộ** chỉ nối các tab trên **cùng một trình duyệt**. Như vậy đủ để thử
> luồng giáo viên–học sinh trên một máy. Muốn dùng trên lớp thì phải cấu hình Firebase (bên dưới).

Kiểm thử bộ sinh đề, máy chấm và luật chơi:

```bash
node --test tests/zipline/*.test.js     # chạy từ thư mục gốc repo
```

## Bật Firebase để dùng trên lớp

1. Vào <https://console.firebase.google.com>, tạo project rồi thêm **Web app**.
2. **Build → Realtime Database → Create database**. Chọn vùng (ví dụ `asia-southeast1`).
3. Tab **Rules**: dán nội dung `database.rules.json` rồi bấm Publish.
4. Chép cấu hình web app vào `js/firebase-config.js`. Bắt buộc phải có `databaseURL`.
5. Đưa thư mục `src/zipline` lên một host tĩnh (Firebase Hosting, GitHub Pages, Netlify…). Học sinh mở link, nhập mã phòng.

Gói miễn phí (Spark) cho **100 kết nối đồng thời**. Một lớp 45 em cộng máy giáo viên vẫn dư.
Mỗi máy học sinh ghi khoảng 1 lần/giây.

## Cấu trúc

```
src/zipline/
  index.html  play.html  teacher.html
  config/game-config.json   ← tham số chỉnh khi thử lớp (tốc độ quái, quãng nhảy, quãng lùi…)
  js/math.js        sinh đề + chấm bằng số hữu tỉ chính xác (mục 4, 5)
  js/game-core.js   luật chơi: quái, mạng, màn (mục 3)
  js/rank.js        xếp hạng
  js/scene.js       cảnh 2D đêm trăng, zip line, hoạt cảnh đúng/sai
  js/view3d.js      hình 3D nhỏ: đường AB, điểm M, đường/điểm sai của học sinh
  js/sprites.js     cắt nhân vật từ ảnh tờ thiết kế, xóa nền đen
  js/net.js         Firebase / thử cục bộ
  js/play.js        màn học sinh   ·   js/teacher.js  màn giáo viên
tests/zipline/      kiểm thử Node
```

## Quyết định đã chốt khi làm

- **Sinh đề và chấm chạy trên máy học sinh** (mục 8, bước 1–2). Không cần máy chủ, chấm tức thì.
  Hạt giống đề là *mã phòng + mã người chơi*, nên tải lại trang vẫn ra bộ đề cũ và giữ tiến độ.
  Đổi lại, em rành công nghệ có thể sửa dữ liệu gửi lên. Với bảng xếp hạng trong lớp thì chấp nhận được.
- **Chấm câu a**: vectơ nhập ≠ 0, cùng phương với AB (tích có hướng = 0), và điểm gốc nằm trên AB.
  Số được tính bằng phân số chính xác, nên `1/2`, `0,5`, `0.5` đều đúng như nhau.
- **Ô trống hoặc gõ sai định dạng không bị phạt**, chỉ nhắc nhở, để không mất mạng oan vì gõ nhầm.
- **Sai câu b thì giữ nguyên câu a** đã đúng. Sai câu nào thì làm lại câu đó, đề giữ nguyên để em sửa lỗi.
- **Quái đứng yên khi đang chạy hoạt cảnh** (đu dây/rơi) để không thiệt em nào.
- Bắt đầu ván có **đếm ngược 3 giây theo giờ máy chủ**, để cả lớp xuất phát cùng lúc.
- Đề tăng dần độ khó: màn đầu chỉ có số dương và t = 1/2; màn giữa có số âm, t có mẫu 3;
  màn cuối có thể có thành phần vectơ bằng 0. Luôn có x hoặc y thay đổi để tìm được t.

## Chỗ tài liệu gốc chưa thống nhất (đang để mặc định, chỉnh được)

- **Giới hạn thời gian**: mục 3 ghi 10 phút, mục 7 và 9 ghi 15 phút. Mặc định đang để **15 phút**,
  giáo viên đổi được khi tạo phòng.
- **Kết thúc ván**: mục 7 ghi "kết thúc khi có người về đích", còn mục 3 lại xếp hạng "theo thứ tự về đích".
  Mặc định đang **kết thúc khi người đầu tiên về đích**. Bỏ chọn ô này khi tạo phòng thì
  những em khác được chơi tiếp tới hết giờ.

## Việc còn bỏ ngỏ (mục 10)

Các tham số quái, thiết bị/wifi, lưu điểm (xuất Google Sheets), thời điểm dùng và sĩ số vẫn chờ thầy/cô trả lời sau buổi thử lớp.
