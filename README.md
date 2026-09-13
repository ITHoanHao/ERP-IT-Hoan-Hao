# ERP Lite - IT Hoàn Hảo (MVP v1.0)

Phần mềm quản lý doanh nghiệp đơn giản: Khách hàng, Nhà cung cấp, Sản phẩm, Kho, Báo giá, Đơn bán, Đơn mua, Nhập kho, Giao hàng, Hóa đơn, Thu/Chi, Báo cáo.

## Yêu cầu cài đặt

Chỉ cần cài **Node.js** (bản 18 trở lên) — tải tại https://nodejs.org (chọn bản LTS, cài như phần mềm bình thường, bấm Next liên tục).

## Cách chạy lần đầu

1. Giải nén thư mục `erp-lite` vào đâu đó trên máy (ví dụ `D:\erp-lite`).
2. Mở **Command Prompt** (hoặc PowerShell), gõ `cd` rồi kéo thả thư mục `erp-lite` vào cửa sổ, nhấn Enter.
3. Gõ lệnh cài đặt (chỉ cần làm 1 lần duy nhất):
   ```
   npm install
   ```
4. Khởi tạo dữ liệu ban đầu (chỉ làm 1 lần duy nhất, hoặc khi muốn làm lại từ đầu):
   ```
   npm run seed
   ```
5. Chạy chương trình:
   ```
   npm start
   ```
6. Mở trình duyệt (Chrome/Edge), vào địa chỉ: **http://localhost:3000**

## Tài khoản đăng nhập lần đầu

- Tên đăng nhập: `admin`
- Mật khẩu: `123456`

**Lưu ý:** MVP hiện tại chưa có màn hình đổi mật khẩu qua giao diện. Nếu cần đổi, báo lại để bổ sung ở bản tiếp theo.

## Những lần chạy sau

**Cách 1 (khuyên dùng):** bấm đúp vào file **`start.bat`** trong thư mục `erp-lite`. Xong, không cần mở Command Prompt nữa.

**Cách 2 (như trước):** mở Command Prompt tại thư mục `erp-lite`, gõ:
```
npm start
```
Sau đó vào lại http://localhost:3000. Không cần chạy lại `npm install` hay `npm run seed`.

**Để dừng chương trình:** bấm `Ctrl + C` trong cửa sổ (hoặc đóng cửa sổ Command Prompt/start.bat).

## Dữ liệu được lưu ở đâu? (Quan trọng — đọc kỹ mục này)

**Từ bản v3.2 trở đi, toàn bộ dữ liệu thật của bạn (database + file hóa đơn/chứng từ đã đính kèm) được lưu ở một nơi CỐ ĐỊNH, TÁCH RIÊNG khỏi thư mục chương trình:**

```
C:\Users\<Tên bạn>\ERPLiteData\
  ├── data.db              (toàn bộ dữ liệu: khách hàng, đơn hàng, hóa đơn, license...)
  └── uploads\             (file hóa đơn điện tử, chứng từ chi phí đã đính kèm)
```

**Ý nghĩa: từ giờ về sau, mỗi lần nâng cấp lên bản mới, bạn KHÔNG CẦN COPY GÌ CẢ.** Chỉ cần:
1. Giải nén bản mới vào **một thư mục bất kỳ** (không cần thư mục cũ, không cần copy `data.db` qua)
2. Chạy `npm install`
3. Bấm `start.bat` (hoặc `npm start`)

Chương trình sẽ tự tìm đúng đến `C:\Users\<Tên bạn>\ERPLiteData\` để đọc dữ liệu — vẫn là dữ liệu cũ của bạn, không mất gì, không cần thao tác thủ công.

**Nếu bạn đang nâng cấp từ bản v3.1 trở về trước (chưa có cơ chế này):** làm đúng 1 lần như hướng dẫn cũ (copy `data.db` và thư mục `uploads` vào thư mục bản mới trước khi chạy) — ngay lần chạy đầu tiên, chương trình sẽ **tự động phát hiện và chuyển dữ liệu đó** sang `C:\Users\<Tên bạn>\ERPLiteData\` (sẽ thấy dòng chữ `[migration] Đã tự động chuyển...` khi khởi động). Từ lần nâng cấp sau, không cần làm lại nữa.

**Muốn sao lưu (backup) định kỳ:** chỉ cần copy toàn bộ thư mục `C:\Users\<Tên bạn>\ERPLiteData\` ra USB/Google Drive — đây là nơi duy nhất chứa dữ liệu thật, không liên quan gì đến thư mục chương trình.

**Muốn đổi vị trí lưu dữ liệu (nâng cao, không bắt buộc):** sửa file `start.bat`, thêm dòng `set ERP_DATA_DIR=Đường-dẫn-bạn-muốn` trước dòng `node server.js`.

## Quy trình sử dụng chính

1. **Khách hàng / Nhà cung cấp / Sản phẩm**: nhập danh mục trước.
   - Với sản phẩm: chọn "Theo Serial" cho máy tính/laptop (quản lý từng máy), "Theo số lượng" cho phụ kiện/linh kiện nhỏ.
2. **Báo giá** → gửi khách → khi khách đồng ý, bấm "Khách đã chốt" → hệ thống **tự động** tạo Đơn bán.
3. **Đơn bán** → nếu cần nhập hàng, bấm "Tạo đơn mua hàng" → chọn Nhà cung cấp.
4. **Đơn mua hàng** → khi hàng về, bấm "Nhận hàng" → nhập serial (mỗi dòng 1 serial, có thể quét mã vạch) hoặc số lượng.
5. Quay lại **Đơn bán** → bấm "Giao hàng" → chọn đúng serial/số lượng cần giao (phải giao đủ 100%) → hệ thống **tự động xuất Hóa đơn** và tính lợi nhuận.
6. **Hóa đơn** → bấm "Ghi nhận thanh toán" khi khách trả tiền.
7. **Thu/Chi** → xem lại lịch sử thu chi, hoặc bấm "Ghi chi phí" cho các khoản chi vận hành (thuê kế toán, công tác phí...).
8. **Báo cáo** → xem Doanh thu/Lợi nhuận theo tháng, Lợi nhuận theo đơn hàng, Công nợ, Tồn kho.

## Cập nhật mới (v1.1)

- **Mã số thuế**: Khách hàng (doanh nghiệp) và Nhà cung cấp đã có thêm trường Mã số thuế.
- **Báo giá theo mẫu công ty**: giá nhập/bán giờ tính **chưa gồm VAT**, mỗi dòng có thuế suất riêng (mặc định 8%, có thể sửa), tự động cộng ra tiền thuế VAT + tổng cộng — đúng theo mẫu báo giá thật bạn đang dùng.
  - **Lưu ý quan trọng:** vì đổi từ "giá đã gồm VAT" sang "giá chưa gồm VAT", **lợi nhuận báo cáo giờ tính trên doanh thu chưa VAT** (đúng chuẩn kế toán, vì VAT không phải doanh thu của công ty) — số lợi nhuận hiển thị sẽ khác một chút so với trước khi có bản cập nhật này.
- **Xuất PDF báo giá**: vào chi tiết báo giá, bấm "Xuất PDF" — file có bố cục giống mẫu báo giá công ty bạn gửi (kính gửi, bảng chi tiết, thuế suất từng dòng, điều khoản, thông tin chuyển khoản).
- **Đính kèm hóa đơn điện tử**: vào chi tiết Hóa đơn, bấm "Đính kèm hóa đơn điện tử" để tải file PDF hóa đơn (xuất từ phần mềm hóa đơn điện tử riêng của bạn) lên lưu trữ. Hệ thống sẽ **cố gắng tự động đọc** số hóa đơn và ngày từ nội dung file, hiển thị để bạn **kiểm tra lại** trước khi lưu.
  - **Giới hạn quan trọng:** chỉ đọc được PDF dạng văn bản (do phần mềm hóa đơn điện tử xuất ra, có thể bôi đen/copy chữ được) — **chưa đọc được ảnh chụp/scan** (cần công nghệ nhận diện chữ trong ảnh, phức tạp hơn, để dành cho bản sau). Với PDF văn bản, việc đọc cũng chỉ là "gợi ý" theo mẫu phổ biến — luôn kiểm tra lại trước khi lưu, đặc biệt nếu mẫu hóa đơn điện tử của NCC dịch vụ hóa đơn khác biệt nhiều.

## Cập nhật mới (v1.2)

- **Định dạng tiền tự động**: mọi ô nhập số tiền (hạn mức công nợ, đơn giá, số tiền thu/chi...) giờ tự động thêm dấu chấm phân cách hàng nghìn khi bạn gõ (ví dụ gõ `100000000` sẽ tự hiện `100.000.000`).
- **Nhóm sản phẩm / Thương hiệu / Đơn vị tính**: đã chuyển từ ô nhập tay sang **danh sách sổ xuống** với các lựa chọn phổ biến ngành IT (theo đúng danh sách bạn cung cấp).
- **Đơn mua hàng nâng cấp**:
  - Mỗi dòng hàng có **Thuế suất riêng** (Không chịu thuế / 0% / 5% / 8% / 10% / Không kê khai... ) — hệ thống tự tính thành tiền gồm VAT khi bạn chọn số lượng + đơn giá + thuế suất.
  - Thêm **Trạng thái theo dõi giao hàng** (Chờ xác nhận, Đang giao hàng, Đã nghiệm thu...) — đây là trạng thái **bạn tự cập nhật thủ công** để theo dõi tiến độ giao vận với nhà cung cấp, **độc lập** với trạng thái hệ thống (Đã đặt/Nhận một phần/Hoàn tất/Đã hủy) vốn vẫn tự động theo đúng logic nghiệp vụ cũ (ví dụ: không cho hủy đơn đã nhận hàng). Có thể đổi trạng thái theo dõi này bất cứ lúc nào ngay tại trang chi tiết đơn mua.

## Cập nhật mới (v1.3)

- **Sản phẩm — Nhập từ nhà cung cấp nào?**: khi thêm/sửa sản phẩm, giờ có thể chọn 1 hoặc nhiều nhà cung cấp thường cung cấp sản phẩm đó (dạng tick chọn). Thông tin này hiển thị ở trang chi tiết sản phẩm, giúp tra cứu nhanh khi cần đặt hàng — chưa tự động điền vào Đơn mua hàng (để dành cải tiến ở bản sau nếu cần).

## Cập nhật mới (v1.4)

- **Nhập từ nhà cung cấp nào?**: đổi từ tick chọn nhiều NCC sang **chọn 1 NCC duy nhất** (dropdown sổ xuống), và đưa trường này lên **ngay dưới Tên sản phẩm** theo đúng yêu cầu.
- Nếu bạn đã dùng bản v1.3 và từng gán nhiều NCC cho 1 sản phẩm, hệ thống sẽ **tự động chọn NCC đầu tiên** đã gán làm nhà cung cấp mặc định khi nâng cấp (không mất dữ liệu, chỉ đơn giản hóa theo mô hình 1-NCC).

## Cập nhật mới (v1.5)

- **Sửa lỗi xuất PDF báo giá**: khi địa chỉ khách hàng (hoặc tên công ty) quá dài phải xuống dòng, các dòng thông tin phía dưới (Mã số thuế, Liên hệ, Điện thoại...) trước đây bị đè chồng lên nhau. Giờ hệ thống tự tính đúng chiều cao từng dòng, xuống dòng gọn gàng không còn chồng chữ.

## Cập nhật mới (v1.6)

- **Sửa lỗi trích xuất hóa đơn điện tử nghiêm trọng**: bản trước dùng quy tắc dò tìm quá lỏng lẻo, có thể đọc nhầm (ví dụ nhầm số hóa đơn thành chữ "thu" trích từ dòng "Mã số thuế"). Đã viết lại, nhắm chính xác vào cấu trúc hóa đơn điện tử chuẩn của Việt Nam (nhãn song ngữ "Số (No.)", "Ký hiệu (Serial)", "Tổng cộng (Total amount)" theo Nghị định 123/Thông tư 78 — hầu hết phần mềm hóa đơn điện tử tuân theo mẫu này). Đã kiểm tra lại bằng chính hóa đơn điện tử thật của công ty — đọc đúng cả 4 giá trị: Ký hiệu, Số hóa đơn, Ngày, Tổng tiền.
- Bổ sung thêm trường **Ký hiệu hóa đơn (Serial)** — hiển thị cùng Số hóa đơn dạng `1C26MTT-104` theo đúng chuẩn định danh hóa đơn điện tử Việt Nam.

## Cập nhật mới (v1.7)

- **Đổi mật khẩu**: bấm icon bánh răng (⚙) trên thanh menu → vào trang Cài đặt → đổi mật khẩu (yêu cầu nhập đúng mật khẩu hiện tại).
- **Xóa với xác nhận mật khẩu quản trị viên**: đã thêm nút "Xóa" cho Khách hàng, Nhà cung cấp, Sản phẩm, Báo giá, Đơn bán, Đơn mua hàng, Hóa đơn, Phiếu Thu/Chi, Chi phí. Khi bấm Xóa, hệ thống yêu cầu nhập lại mật khẩu — sai mật khẩu thì không cho xóa.
  - **An toàn dữ liệu tự động**: nếu bạn cố xóa 1 chứng từ đang được chứng từ khác tham chiếu (ví dụ: xóa báo giá đã có Đơn bán sinh ra từ nó, hoặc xóa sản phẩm đã có trong đơn hàng), hệ thống sẽ **tự động từ chối** và báo rõ lý do — tránh vô tình làm sai lệch dữ liệu đã phát sinh.
  - Xóa Phiếu thu gắn với hóa đơn → hóa đơn tự động trở về trạng thái "Chưa thu".
  - Xóa Chi phí → phiếu chi tự động sinh ra kèm theo cũng được xóa theo, không để sót dữ liệu thu chi không có chứng từ gốc.
  - Mọi lượt xóa đều được ghi lại trong cửa sổ chạy chương trình (Command Prompt) để tra cứu nếu cần.

## Cập nhật mới (v1.8)

- **Tổ chức lại menu theo đúng quy trình làm việc**: gộp thành nhóm "Quy trình bán hàng" (Báo giá → Đơn bán → Đơn mua hàng → Giao hàng → Hóa đơn, đúng thứ tự công ty làm), nhóm "Danh mục" (Khách hàng, Nhà cung cấp, Sản phẩm, Kho), còn Thu/Chi và Báo cáo để riêng — gọn hơn, đỡ rối mắt.
- **Thêm trang danh sách Giao hàng** (trước đây chưa có, chỉ xem được từng phiếu lẻ).
- **Xuất Biên bản bàn giao (PDF)**: vào chi tiết Hóa đơn → bấm "Biên bản bàn giao" — theo đúng mẫu công ty (không đóng dấu, để bạn tự in và ký đóng dấu sau).
- **Xuất Đề nghị thanh toán (PDF)**: cùng vị trí, theo đúng mẫu số 05-TT — tự động điền tên người đề nghị thanh toán theo tài khoản đăng nhập, số tiền, thông tin ngân hàng.
- **Sửa lỗi phát hiện trong lúc làm**: thông tin bảo hành (tháng) trước đây bị rớt mất khi báo giá chuyển thành Đơn bán (do thiếu 1 cột lưu trữ) — nay đã sửa, bảo hành hiển thị đúng xuyên suốt Đơn bán → Biên bản bàn giao → Đề nghị thanh toán.

## Cập nhật mới (v1.9)

- **Xóa Giao hàng** (yêu cầu mật khẩu, giống các module khác) — nhưng làm kỹ hơn: khi xóa, hệ thống **tự động hoàn tác tồn kho** (serial về lại "Trong kho", số lượng cộng lại vào lô, Đơn bán về lại trạng thái "Đã tạo"). Nếu Đơn bán đã có Hóa đơn sinh ra từ lần giao hàng đó, hệ thống **chặn xóa** và yêu cầu xóa Hóa đơn trước — tránh để hóa đơn "mồ côi" không có giao hàng tương ứng.
- **Đính kèm hóa đơn/chứng từ cho Chi phí** — có thể đính kèm ngay lúc ghi nhận, hoặc để trống và đính kèm sau. Đã thêm trang chi tiết Chi phí (trước đây chưa có) để xem/thêm file đính kèm.
- **Cơ chế nhắc nhở**: nếu chưa đính kèm hóa đơn, hệ thống hiển thị cảnh báo ngay trên Dashboard ("Có N khoản chi phí chưa đính kèm hóa đơn") và gắn nhãn "Thiếu hóa đơn" trong danh sách Chi phí — nhắc liên tục cho đến khi bạn bổ sung.
- **Sửa lỗi phát hiện trong lúc làm**: link "Đơn bán gần đây" trên Dashboard trước đây bị sai (dùng nhầm số đơn thay vì mã định danh nội bộ, bấm vào sẽ không ra đúng trang) — đã sửa.
- Xóa Hóa đơn giờ cũng bị chặn nếu đã có Phiếu thu gắn với nó (nhất quán với logic xóa Giao hàng).

## Cập nhật mới (v2.0)

- **Thêm sản phẩm nhanh ngay trong màn hình Báo giá**: ở ô "Sản phẩm" của từng dòng, chọn "+ Thêm sản phẩm mới..." → hiện popup nhập tên + hình thức quản lý tồn kho + đơn vị tính → Lưu là sản phẩm được tạo và **tự động chọn luôn** vào dòng đó, không rời khỏi màn hình báo giá đang làm dở. Sản phẩm mới cũng xuất hiện luôn trong các dòng thêm sau đó.
  - Đây là "thêm nhanh" — chỉ có tên/tồn kho/đơn vị tính. Muốn khai báo đầy đủ nhóm/thương hiệu/nhà cung cấp, vào mục Sản phẩm để bổ sung sau.

## Cập nhật mới (v2.1)

- **Popup "Thêm sản phẩm mới" đầy đủ trường** giống hệt màn hình Thêm sản phẩm chính thức: Nhà cung cấp, Nhóm sản phẩm, Thương hiệu, Hình thức quản lý tồn kho, Đơn vị tính, Mức tồn kho tối thiểu, Bảo hành mặc định — không còn chỉ 3 trường rút gọn như trước.
- **Bỏ "Dịch vụ tự do"** khỏi ô chọn sản phẩm trong Báo giá — mỗi dòng giờ bắt buộc phải chọn 1 sản phẩm (có sẵn hoặc thêm mới ngay qua popup). Cột "Mô tả" đổi thành "Ghi chú thêm" (không bắt buộc, dùng để ghi chú bổ sung).
- **Danh sách Đơn vị tính mới** (53 đơn vị theo đúng danh sách bạn cung cấp: Bao, Bình, Bộ, Ca, Cái, Can... Xấp) áp dụng cho cả form Sản phẩm chính thức và popup thêm nhanh.
- **Thêm tùy chọn "Khác (nhập thủ công)"** ở cuối danh sách Đơn vị tính — chọn vào sẽ hiện ô nhập tay để gõ đơn vị tùy ý không có trong danh sách. Sản phẩm cũ có đơn vị không nằm trong danh sách mới sẽ tự động hiển thị đúng ở chế độ "Khác" kèm giá trị cũ, không mất dữ liệu.

## Cập nhật mới (v2.2)

- **Nút "Xóa toàn bộ chuỗi liên quan"** trên trang chi tiết Báo giá: khi báo giá đã có Đơn bán sinh ra (và có thể đã có Giao hàng/Hóa đơn/Phiếu thu theo sau), thay vì phải xóa từng bước, bấm 1 nút này sẽ xóa **toàn bộ chuỗi trong 1 lần** (Phiếu thu → Hóa đơn → Giao hàng → Đơn bán → Báo giá), tự động hoàn tác tồn kho, chỉ cần nhập 1 lần mật khẩu quản trị viên. Popup sẽ liệt kê rõ chính xác những gì sẽ bị xóa trước khi bạn xác nhận.
  - **Đơn mua hàng liên kết (nếu có) KHÔNG bị xóa theo** — vì hàng đã nhập về là dữ liệu thật, vẫn có thể dùng cho đơn hàng khác sau này. Hệ thống chỉ gỡ liên kết tham khảo, không xóa nguồn cung ứng.
- Nếu báo giá chưa có Đơn bán (còn Nháp/Đã gửi khách/Từ chối), nút "Xóa" thường vẫn hoạt động như cũ (không cần xóa chuỗi vì chưa có gì phát sinh).

## Cập nhật mới (v2.3)

- **Sửa cách làm tròn VAT** cho đúng chuẩn hóa đơn điện tử Việt Nam: trước đây hệ thống cộng dồn tiền thuế của tất cả các dòng rồi mới làm tròn 1 lần ở cuối; giờ **làm tròn tiền thuế của từng dòng riêng biệt trước, rồi mới cộng lại** — đúng theo cách cơ quan Thuế/phần mềm hóa đơn điện tử tính. Áp dụng cho cả Báo giá và Đơn mua hàng.
  - **Lưu ý quan trọng còn tồn tại:** nếu đơn giá gốc trên hóa đơn điện tử của bạn là số lẻ (ví dụ 416.666,67 — do chia đều 1 khoản tiền tổng cho nhiều sản phẩm), mà hệ thống này chỉ cho nhập số nguyên (416.667), thì tổng cuối cùng vẫn có thể lệch 1-2 đồng so với hóa đơn điện tử thật — đây là do khác đơn giá gốc, không phải lỗi làm tròn. Nếu cần khớp tuyệt đối 100% trong các trường hợp này, hệ thống cần hỗ trợ nhập đơn giá có số lẻ — báo lại nếu bạn cần bổ sung.

## Cập nhật mới (v2.4)

- **Hỗ trợ nhập đơn giá có số lẻ**: ô "Đơn giá" trong Báo giá và Đơn mua hàng giờ nhận được số thập phân (dấu phẩy `,` là phần lẻ, dấu chấm `.` vẫn ngăn cách hàng nghìn như bình thường — ví dụ gõ `416666,666667` sẽ hiện `416.666,666667`). Các ô tiền khác (hạn mức công nợ, số tiền thu/chi...) vẫn chỉ nhận số nguyên như cũ, không đổi.
- **Làm tròn "Thành tiền" từng dòng** (không chỉ tiền thuế) trước khi cộng vào tổng — đúng 100% theo cách hệ thống hóa đơn điện tử/cơ quan Thuế tính. Đã kiểm tra khớp chính xác từng đồng với ví dụ hóa đơn điện tử thật bạn gửi (Tạm tính 5.666.666, Thuế 453.334, Tổng cộng 6.120.000).
- Với các đơn giá thông thường (số nguyên, không chia lẻ), mọi thứ vẫn hoạt động y hệt trước — thay đổi này chỉ ảnh hưởng khi bạn thực sự cần nhập số lẻ để khớp hóa đơn gốc.

## Cập nhật mới (v2.5)

- **Nhóm sản phẩm, Thương hiệu, Đơn vị tính giờ là danh sách "sống"** — không còn cố định trong code nữa. Ở cả form Sản phẩm chính thức lẫn popup "Thêm sản phẩm nhanh" trong Báo giá, mỗi ô đều có tùy chọn **"+ Thêm mới..."** ở cuối danh sách: chọn vào, nhập giá trị mới, bấm "Lưu & chọn" — giá trị đó được **lưu vĩnh viễn** và xuất hiện trong danh sách từ đó về sau (giống hệt cách "Thêm sản phẩm mới" hoạt động).
- Danh sách mặc định ban đầu (10 nhóm, 20 thương hiệu, 53 đơn vị) được giữ nguyên khi nâng cấp — không mất dữ liệu cũ.
- Bỏ cơ chế "Khác (nhập thủ công)" cũ của riêng Đơn vị tính — vì giờ "+ Thêm mới" đã thay thế hoàn toàn với ưu điểm lưu lại để dùng tiếp lần sau.

## Cập nhật mới (v2.6)

- **Công cụ "Tính đơn giá từ tổng tiền mong muốn"** (icon máy tính 🧮 cạnh ô Đơn giá trong Báo giá): nhập tổng tiền bạn muốn có cho dòng đó (đã gồm VAT, ví dụ 2.180.000), hệ thống tự tính ngược ra đúng đơn giá chưa VAT cần nhập để khi lưu, mọi con số khớp tự nhiên — **không sửa cách tính, không cộng/trừ số ép buộc**, chỉ giúp bạn tìm đúng đầu vào. Đã kiểm tra với nhiều số lượng/thuế suất khác nhau, luôn ra khớp tuyệt đối 100%.

## Cập nhật mới (v2.7)

- **Công cụ "Tính đơn giá từ tổng tiền mong muốn"** giờ có thêm ở **Đơn mua hàng** (trước đó chỉ có ở Báo giá) — icon máy tính 🧮 cạnh ô "Giá nhập dự kiến", hoạt động y hệt: nhập tổng tiền muốn thanh toán cho NCC (đã gồm VAT), hệ thống tự tính ra giá nhập chưa VAT cần nhập để khớp tự nhiên.

## Cập nhật mới (v3.0) — Module License

- **Quản lý License khách hàng đã mua**: menu "Quy trình bán hàng" → "License". Mỗi license lưu: khách hàng, tên license, số lượng, đơn giá (chưa VAT), thuế suất, ngày bắt đầu/hết hạn — tự tính thành tiền y hệt cách Báo giá đang làm (kể cả công cụ tính ngược đơn giá từ tổng tiền mong muốn).
- **Nhắc gia hạn tự động**: Dashboard hiện cảnh báo đỏ nếu có license sắp hết hạn trong 14 ngày tới (hoặc đã quá hạn), kèm danh sách để bạn liên hệ khách hàng hỏi gia hạn.
- **Gia hạn = giao dịch mới**: bấm "Gia hạn" sẽ tạo 1 license mới (form tự điền sẵn thông tin cũ để chỉnh sửa giá/thời hạn mới), liên kết ngược về license gốc — giữ đầy đủ lịch sử, license cũ tự chuyển trạng thái "Đã gia hạn".
- **Thông tin người dùng cuối (Microsoft)**: tick "Đây là license Microsoft" sẽ hiện thêm các trường Tên công ty, Địa chỉ, Điện thoại, Người quản lý License, Email quản trị, Tenant/domain .onmicrosoft.com — **lưu chung theo từng khách hàng**, chỉ cần nhập 1 lần, dùng lại cho mọi license Microsoft sau này của khách đó.
- **Xuất PDF "Thông tin yêu cầu đặt hàng"**: đúng theo mẫu bạn gửi — gồm 2 phần (thông tin công ty bạn + thông tin người dùng cuối), chỉ hiện với license Microsoft.
- **Mục Cài đặt** bổ sung phần "Thông tin công ty" (mã số thuế, địa chỉ, điện thoại, người nhận giấy tờ, email kế toán, email nhận bản quyền) — tự sửa được, không cần nhờ sửa code.
- Xóa License có xác nhận mật khẩu như các module khác.

## Cập nhật mới (v3.1) — Sửa lỗi quan trọng

- **Sửa lỗi "Giấy đề nghị thanh toán" thiếu tiền thuế VAT**: phát hiện khi rà soát lại tính năng ở v1.8 — chứng từ này trước đây chỉ hiển thị số tiền **chưa gồm VAT**, có thể khiến bạn yêu cầu khách thanh toán **thiếu đúng phần thuế** nếu giao dịch có VAT. Đã sửa: giờ hiển thị đầy đủ Tạm tính → Tiền thuế VAT → **Tổng tiền phải thanh toán (đã gồm VAT)** — đúng số tiền khách hàng thực sự cần trả.
- **Biên bản bàn giao giữ nguyên không đổi** — vì đây là chứng từ xác nhận đã giao đủ hàng, không phải chứng từ đòi tiền, nên không cần thể hiện VAT (đúng như mẫu gốc bạn cung cấp).

## Cập nhật mới (v3.2) — Đơn giản hóa việc nâng cấp phiên bản

- **Thay đổi kiến trúc quan trọng**: dữ liệu thật (database + file đính kèm) giờ lưu ở thư mục cố định `C:\Users\<Tên bạn>\ERPLiteData\`, **tách hẳn khỏi thư mục chương trình**. Xem chi tiết ở mục "Dữ liệu được lưu ở đâu?" phía trên.
- **Lợi ích**: từ bản này về sau, mỗi lần nâng cấp chỉ cần giải nén bản mới và chạy — **không cần copy `data.db` hay bất kỳ file nào nữa**.
- **An toàn cho người nâng cấp từ bản cũ**: lần đầu chạy bản v3.2, nếu phát hiện `data.db`/file đính kèm còn nằm trong thư mục chương trình theo kiểu cũ, hệ thống **tự động chuyển** sang vị trí mới, không cần thao tác gì thêm.
- **Thêm file `start.bat`**: bấm đúp để chạy chương trình, không cần mở Command Prompt gõ lệnh nữa.

## Cập nhật mới (v3.3)

- **Thêm cột "Sản phẩm/Dịch vụ" xem trước** vào 5 danh sách: Báo giá, Đơn bán, Đơn mua hàng, Giao hàng, Hóa đơn — giúp nhìn lướt qua danh sách là biết ngay đơn nào chứa sản phẩm gì, không cần bấm vào từng đơn để xem. Tên sản phẩm quá dài sẽ tự động rút gọn (...) để không phá bố cục bảng.

## Cập nhật mới (v3.4) — Module Hợp đồng + Lưu tài liệu đính kèm

- **Module Hợp đồng mới**: nút **"Tạo hợp đồng"** tự động hiện trên trang chi tiết Đơn bán khi giá trị đơn **trên 20.000.000đ**. Hợp đồng tự lấy sẵn bảng sản phẩm + tổng tiền từ Đơn bán, bạn chỉ cần điền thêm: người đại diện khách hàng, bảo hành, hiệu lực giá, tiến độ thanh toán, địa điểm giao hàng.
  - Thông tin **Người đại diện, Chức vụ, Số tài khoản** của khách hàng được lưu lại, dùng chung cho mọi hợp đồng sau này của khách đó (giống Tenant Microsoft).
  - **Xuất PDF hợp đồng** đầy đủ 15 điều theo đúng mẫu công ty bạn gửi, tự động chèn bảng sản phẩm và **tự đọc số tiền bằng chữ** (VD: 629.520.000 → "Sáu trăm hai mươi chín triệu năm trăm hai mươi nghìn đồng").
  - Hợp đồng có thể Sửa (khi còn Nháp), Đánh dấu đã ký, Hủy, Xóa (có xác nhận mật khẩu).
- **Lưu tài liệu đính kèm (đã ký/scan) để tra cứu sau này**: thêm mục "Tài liệu đính kèm" ở trang chi tiết Báo giá, Hóa đơn (bổ sung thêm mục riêng cho Biên bản bàn giao/Đề nghị thanh toán đã ký, không ảnh hưởng mục đính kèm hóa đơn điện tử đã có), và Hợp đồng — tải lên bất kỳ lúc nào, nhiều file, có nhãn ghi chú, xem/tải lại dễ dàng.

## Cập nhật mới (v3.5)

- **Tách 2 dòng upload riêng biệt** ở trang chi tiết Hóa đơn: "Biên bản bàn giao đã ký" và "Đề nghị thanh toán đã ký" giờ có ô chọn file + nút "Tải lên" **riêng cho từng loại**, không cần gõ tay nhãn như trước — bấm đúng dòng nào là gán đúng nhãn đó, tránh nhầm lẫn.

## Cập nhật mới (v3.6)

- **Sửa "Giấy đề nghị thanh toán"**: dòng "Họ và tên người đề nghị thanh toán" giờ lấy từ mục Cài đặt (mặc định "Bùi Bảo Châu", có thể sửa lại thành tên công ty hoặc tên khác trong Cài đặt → Thông tin công ty). Bỏ dòng "Bộ phận", thay bằng "Địa chỉ" lấy từ Cài đặt.
- Xác nhận: dòng "Nội dung thanh toán" đã tự động ưu tiên dùng **số hóa đơn tài chính đã upload** (nếu có) thay vì mã nội bộ — cơ chế này đã có sẵn từ trước, không cần thay đổi gì thêm.

## Cập nhật mới (v3.7) — start.bat giờ tự làm hết, chỉ cần double-click

- **`start.bat` giờ tự động cài đặt (`npm install`) và tự tạo tài khoản (`npm run seed`) nếu là lần đầu chạy** — bạn chỉ cần **double-click 1 lần duy nhất**, không cần mở Command Prompt gõ lệnh nữa, kể cả lần chạy đầu tiên ở thư mục mới.
- Đã test lại toàn bộ chuỗi từ trạng thái hoàn toàn trống (chưa cài gì, chưa có dữ liệu) đến đăng nhập thành công.

## Cập nhật mới (v3.8)

- **Gõ chữ để tìm kiếm** ở tất cả các ô chọn Sản phẩm, Khách hàng, Nhà cung cấp trong toàn hệ thống (Báo giá, Đơn mua hàng, License, form Sản phẩm) — không cần cuộn danh sách dài nữa, gõ vài chữ là lọc ra ngay. Vẫn giữ nguyên chức năng "+ Thêm sản phẩm mới..." như trước.

## Cập nhật mới (v3.9) — Chuông thông báo + Trang Theo dõi đơn hàng + Ẩn số liệu tài chính

- **Ẩn số liệu tài chính trên Dashboard**: Doanh thu, Lợi nhuận, Công nợ phải thu giờ ẩn mặc định (hiện dấu ●●●). Bấm "Xem số liệu tài chính" → nhập đúng mật khẩu quản trị viên mới hiện số thật. Đây là ẩn thật sự ở phía máy chủ (không gửi số liệu về trình duyệt cho đến khi xác thực đúng), không phải chỉ che bằng giao diện. Cột "Tổng tiền" ở bảng Đơn bán gần đây vẫn hiển thị bình thường theo yêu cầu.
- **Chuông thông báo** (góc phải, cạnh icon Cài đặt): tự động nhắc 4 việc cần xử lý theo đúng quy trình công ty:
  1. Báo giá đã gửi khách quá 3 ngày chưa chốt
  2. Đơn bán đã chốt hơn 1 ngày chưa đặt hàng NCC (**chỉ nhắc nếu sản phẩm thực sự thiếu tồn kho** — nếu đã có sẵn hàng thì không nhắc)
  3. Đã nhận hàng từ NCC hơn 1 ngày chưa giao cho khách
  4. Đã giao hàng hơn 1 ngày chưa đính kèm hóa đơn điện tử (phân biệt rõ với các file đính kèm khác như Biên bản bàn giao/Đề nghị thanh toán đã ký)
  
  Bấm vào từng thông báo dẫn thẳng tới đúng đơn hàng cần xử lý. Thông báo tự động biến mất khi việc đó đã hoàn thành.
- **Trang "Theo dõi đơn hàng"** (menu trên cùng): mỗi đơn hàng hiển thị trực quan 4 ô tiến độ (Báo giá → Đặt hàng NCC → Giao hàng → Chứng từ), ô đã xong sáng xanh, ô đang chờ mờ xám, ô bị trễ hạn có dấu chấm đỏ — dùng chung đúng 1 nguồn dữ liệu với chuông thông báo nên luôn khớp nhau. Đơn hàng hoàn tất toàn bộ 4 bước sẽ tự động biến mất khỏi trang.

## Cập nhật mới (v4.0)

- **Thêm bước 5 vào Theo dõi đơn hàng: "Ghi nhận thanh toán"** — đơn hàng giờ hoàn tất khi cả 5 bước xong (Báo giá → Đặt hàng NCC → Giao hàng → Chứng từ + hóa đơn điện tử → **Ghi nhận thanh toán**). Bước này tự động "trễ hạn" đúng theo hạn công nợ của khách hàng (không phải cố định 1 ngày như các bước khác).
- **Chuông thông báo bổ sung 2 loại mới**:
  - Đơn hàng **quá hạn thanh toán** theo đúng hạn công nợ khách hàng — nhắc khách thanh toán, tự hết khi ghi nhận thanh toán xong.
  - **License sắp hết hạn / đã quá hạn** — nhắc gia hạn cho khách (trước đây chỉ hiện ở Dashboard, giờ có cả ở chuông mọi trang).
- **Module License hỗ trợ Autodesk** (song song Microsoft): chọn nhà cung cấp qua dropdown thay vì tick chọn — chọn Microsoft hiện đúng các trường Tenant, chọn Autodesk hiện đúng: Tên người dùng cuối, Email nhận license, Người quản lý license (email), Contract ID, Subscription ID. Thông tin lưu theo từng khách hàng, dùng lại cho các license Autodesk sau này.
  - **Lưu ý:** nút "Xuất thông tin đặt hàng (PDF)" hiện chỉ áp dụng cho Microsoft (đúng theo mẫu công ty đã cung cấp) — Autodesk chưa có mẫu PDF riêng, chỉ lưu trữ thông tin để tra cứu.

## Cập nhật mới (v4.1)

- **Xuất PDF "Thông tin đặt hàng" cho Autodesk** — cùng bố cục gọn gàng như Microsoft (2 bảng: thông tin công ty bạn + thông tin người dùng cuối), chỉ khác nội dung bảng 2 theo đúng trường Autodesk (Tên người dùng cuối, Email nhận license, Người quản lý license, Contract ID, Subscription ID).

## Cập nhật mới (v4.2)

- **Danh sách License**: đổi cột "Khách hàng" thành **"Người dùng cuối"** — hiển thị đúng tên người/công ty thực sự đang dùng license (lấy từ thông tin Tenant Microsoft / hồ sơ Autodesk đã khai báo), giúp bạn biết chính xác cần liên hệ ai để nhắc gia hạn. Nếu tên người dùng cuối khác với tên khách hàng trong hệ thống, vẫn hiện thêm dòng nhỏ "(KH: ...)" để không mất thông tin đối chiếu nội bộ. Với license chưa khai báo nhà cung cấp đặc biệt, cột này tự động hiện tên khách hàng như trước.

## Cập nhật mới (v4.3)

- Danh sách License: bỏ dòng phụ "(KH: ...)" — chỉ hiện gọn tên Người dùng cuối, muốn xem đầy đủ thông tin khách hàng thì bấm vào chi tiết license.

## Cập nhật mới (v4.4) — Sửa quan trọng: bỏ ràng buộc End-User theo Khách hàng

- **Phát hiện từ thực tế sử dụng**: 1 khách hàng có thể có NHIỀU end-user khác nhau (ví dụ nhiều chi nhánh, mỗi chi nhánh 1 Tenant Microsoft riêng). Trước đây thông tin Tenant/Autodesk lưu chung theo khách hàng, nên license sau sẽ ghi đè thông tin của license trước — SAI trong trường hợp này.
- **Đã sửa**: thông tin end-user (Tenant Microsoft / hồ sơ Autodesk) giờ lưu **riêng theo từng License**, không còn dùng chung theo khách hàng nữa. Bạn có thể tự do nhập khác nhau cho từng license, kể cả cùng 1 khách hàng.
- Gia hạn License vẫn mang đúng thông tin end-user của **chính license đó** (không lấy nhầm từ license khác của cùng khách hàng).
- Dữ liệu cũ (nếu có, lưu theo khách hàng ở các bản v4.0-v4.3) sẽ **tự động chuyển đúng** vào từng License khi nâng cấp — không mất dữ liệu, không cần thao tác gì thêm.

## Cập nhật mới (v5.0) — Module Quản lý nhà trọ (hoàn toàn tách biệt với ERP công ty IT)

- **Menu "Nhà trọ" mới** — quản lý hoàn toàn độc lập, không liên quan gì đến dữ liệu Khách hàng/Đơn hàng của IT Hoàn Hảo.
- **Quản lý phòng trọ**: 7 phòng đã seed sẵn theo đúng dữ liệu thực tế (Trệt, 1-6), mỗi phòng cấu hình riêng: giá phòng, cách tính điện (theo đồng hồ hoặc cố định/người — Phòng Trệt không có đồng hồ), giảm giá điện riêng (Phòng 5: -50k), phí quản lý gộp vào tiền phòng hay tính riêng (Phòng 3, 6), và trừ số điện chéo (Phòng 6 = số ghi nhận − Phòng 3 − Phòng 4).
- **Quản lý người thuê trọ + gán phòng**: thêm/sửa thông tin người thuê, gán vào phòng, đánh dấu chuyển đi — tự động cập nhật số người để tính đúng tiền nước/máy giặt/phí quản lý.
- **Nhập số điện & tính tiền hàng tháng**: 1 màn hình nhập cho tất cả các phòng cùng lúc, số điện cũ tự động lấy từ tháng trước, tự tính đúng mọi quy tắc đặc thù (đã test khớp 100% với số liệu thật trong file bạn cung cấp, kể cả phép trừ chéo Phòng 6).
- **Xuất PDF "Thông báo tiền phòng trọ"** đúng theo mẫu bạn gửi.
- **Chi phí vận hành hàng tháng** (thuê nhà nguyên căn, điện/nước/rác/internet/công an) và **Dashboard lợi nhuận** = Doanh thu thu từ khách thuê − Chi phí vận hành.
- **Lưu ý quan trọng đã thống nhất:** giảm giá điện Phòng 5 (-50k) được áp dụng đúng theo quy tắc bạn dặn — có thể khác với số bạn đã thông báo cho khách ở các tháng trước (do file cũ chưa áp dụng đúng khoản giảm này).

## Cập nhật mới (v5.1)

- **Sửa thiếu sót menu Nhà trọ**: menu "Nhà trọ" giờ là danh sách sổ xuống đầy đủ (Tổng quan, Người thuê trọ, Gán/chuyển phòng, Danh sách phòng, Báo cáo) — trước đó chỉ có 1 link duy nhất vào Tổng quan, không có cách nào bấm tới trang Người thuê trọ dù trang đó đã có sẵn. Cũng thêm nút truy cập nhanh ngay trên Dashboard nhà trọ.

## Cập nhật mới (v5.2)

- **Sửa Biên bản bàn giao**: đơn giá/thành tiền giờ hiển thị **đã gồm VAT** (trước đây hiện chưa VAT) — khớp đúng với tổng tiền hóa đơn thật, làm tròn từng dòng đúng cách như hóa đơn để không lệch đồng nào. Giấy đề nghị thanh toán giữ nguyên như cũ (không đổi).
- **Trang Theo dõi đơn hàng**: mỗi đơn hàng giờ hiện thêm tên hàng hóa + tổng giá tiền ngay bên dưới tên khách hàng — không cần bấm vào từng đơn mới biết đang chứa gì.

## Cập nhật mới (v5.3) — Module Tổng vụ: Nhân sự + Tài sản

- **Menu "Tổng vụ" mới**: Tổng quan, Nhân viên, Tài sản.
- **Quản lý nhân viên**: mã NV tự sinh, thông tin cá nhân, chức vụ/chi nhánh, hợp đồng, ngày vào/nghỉ việc. **Lương cơ bản ẩn mặc định**, cần đúng mật khẩu quản trị viên mới xem được (giống Dashboard) — danh sách nhân viên không hiển thị lương ở bất kỳ đâu.
- **Quản lý tài sản**: mã tài sản tự sinh, nhóm/serial/nhà cung cấp (liên kết danh sách NCC có sẵn), ngày mua + số hóa đơn + nguyên giá, bảo hành, tình trạng (Đang dùng/Hỏng/Thanh lý/Trong kho/Thất lạc).
- **Khấu hao tự động** (đường thẳng): nhập nguyên giá + thời gian khấu hao (mặc định 36 tháng), hệ thống tự tính khấu hao lũy kế và giá trị còn lại theo thời gian thực, không cần tính tay.
- **Gán tài sản cho nhân viên** qua danh sách chọn (không gõ tay) — trang chi tiết nhân viên hiện đủ tài sản đang cầm, trang chi tiết tài sản hiện đúng người đang dùng — liên kết 2 chiều.
- **Đính kèm tài liệu** cho tài sản (hóa đơn mua, biên bản bàn giao...) dùng chung cơ chế lưu trữ đã có.

## Cập nhật mới (v5.4) — Hoàn thiện form Nhân viên

- **Ngày sinh**: đổi sang ô chọn lịch (như mọi ô ngày khác trong hệ thống), hiển thị đúng dd/mm/yyyy, không còn gõ tay tự do.
- **Thêm Trình độ học vấn** (dropdown: THPT/Trung cấp/Cao đẳng/Đại học/Sau đại học/Khác).
- **Chức vụ, Chi nhánh/Phòng ban** giờ là danh sách mở rộng được — gõ để tìm, có nút "+ Thêm mới..." để tự thêm giá trị mới, dùng lại cho lần sau (giống hệt cách Nhóm sản phẩm/Thương hiệu hoạt động).
- **Thông tin ngân hàng tách thành 4 ô riêng**: Ngân hàng (danh sách 20 ngân hàng VN phổ biến, có thể thêm ngân hàng khác), Chi nhánh ngân hàng, Số tài khoản, Tên tài khoản — thay vì 1 ô gõ tự do như trước.
- **Đính kèm hồ sơ nhân viên** (CV, bằng cấp, hợp đồng lao động, scan CMND/CCCD...) — dùng chung cơ chế lưu trữ tài liệu đã có ở Báo giá/Hóa đơn/Hợp đồng/Tài sản.
- Dữ liệu ngân hàng cũ (nếu có, dạng 1 dòng text) sẽ **tự động chuyển đúng** vào ô Số tài khoản khi nâng cấp.

## Cập nhật mới (v5.5) — Soạn email gửi khách tự động + Liên hệ nhiều email

- **Nút "Gửi email cho khách"** ở trang chi tiết Hóa đơn — tự động mở Outlook đã điền sẵn người nhận (To/CC), tiêu đề đúng công thức `[Đề nghị thanh toán] Tiêu đề ngắn gọn - ngày hóa đơn (ddmmyyyy)`, và nội dung email theo mẫu công ty. Kèm danh sách link để kéo-thả file đính kèm (Báo giá, Biên bản bàn giao, Đề nghị thanh toán, hóa đơn điện tử đã lưu...). Đã test khớp chính xác với email mẫu thực tế bạn cung cấp.
- **Khách hàng lưu được nhiều email liên hệ theo vai trò** (Người mua hàng → To, Kế toán/Admin → CC...) — quản lý ngay tại trang chi tiết khách hàng.
- **Báo giá có thêm ô "Tiêu đề ngắn gọn"** (không bắt buộc) — dùng cho tiêu đề email, nếu bỏ trống tự lấy tên sản phẩm đầu tiên thay thế.
- **Hỗ trợ tải lên file XML hóa đơn điện tử** (bên cạnh PDF đã có) — lưu trực tiếp để tra cứu, không cần qua bước trích xuất.

## Cập nhật mới (v5.6)

- **Sửa email mất đẹp**: bỏ phần chữ ký tự viết (chữ thường, không logo) — nội dung email giờ dừng đúng ở "Thanks and Best Regards," để **chính Outlook tự động chèn chữ ký đẹp có sẵn của bạn** (logo, định dạng, link...) vào bên dưới, y hệt cách soạn email bình thường. Cần đảm bảo Outlook đã bật "Tự động thêm chữ ký vào tin nhắn mới" (File → Options → Mail → Signatures).

## Cập nhật mới (v5.7)

- **Xóa file đính kèm sai/nhầm**: mọi nơi có tài liệu đính kèm (Hóa đơn, Báo giá, Hợp đồng, Tài sản, Nhân viên) giờ có nút "Xóa" cạnh từng file — cần đúng mật khẩu quản trị viên mới xóa được, xóa cả trong hệ thống và file vật lý trên đĩa.
- **Thêm ô tìm kiếm cho 5 trang danh sách**: Báo giá, Đơn bán, Đơn mua hàng, Giao hàng, Hóa đơn — tìm theo số chứng từ, tên khách hàng/nhà cung cấp, hoặc tên sản phẩm đều ra kết quả đúng.

## Cập nhật mới (v5.8)

- **Bộ lọc kiểu Excel** cho danh sách License (lọc theo Người dùng cuối, Tên license, Trạng thái) và danh sách Hợp đồng (lọc theo Khách hàng, Trạng thái) — bấm biểu tượng phễu cạnh tên cột, chọn/bỏ chọn giá trị cần xem, giống hệt cách lọc trong Excel. Không cần tải lại trang, lọc ngay trên trình duyệt.

## Cập nhật mới (v5.9) — Module Hợp đồng thuê trọ

- **Menu "Nhà trọ" → "Hợp đồng thuê trọ"**: mỗi người thuê có 1 hợp đồng riêng (kể cả phòng nhiều người ở), theo dõi ngày bắt đầu/kết thúc, tiền cọc, đăng ký máy giặt.
- **Nhắc gia hạn/chấm dứt trước 1 tháng**: hợp đồng sắp hết hạn hoặc đã quá hạn tự động hiện ở chuông thông báo và tô màu trong danh sách — hỏi khách gia hạn hay chấm dứt kịp thời.
- **Gia hạn = tạo hợp đồng mới** (giữ lịch sử hợp đồng cũ), giống hệt cách License đã làm.
- **Xuất PDF hợp đồng thuê trọ** đúng theo mẫu bạn gửi, tự động điền: thông tin người thuê, giá phòng (tự tính sẵn theo phòng), tiền cọc, đọc số tiền bằng chữ, tự tính đúng số năm hợp đồng từ ngày bắt đầu/kết thúc — sẵn sàng in ra ký ngay.
- Gán phòng cho người thuê giờ thu thập luôn thông tin hợp đồng (ngày bắt đầu/kết thúc, tiền cọc, đăng ký máy giặt) ngay từ bước gán, không cần vào sửa lại sau.
- Thêm mục "Thông tin chủ nhà trọ" trong Cài đặt (dùng làm Bên A khi in hợp đồng) — điền sẵn theo đúng mẫu bạn gửi, tự sửa được.
- **Lỗi tôi tự phát hiện và sửa trong lúc test:** xuất PDF cho "Phòng Trệt" (tên có dấu) bị lỗi 500 do tên file chứa ký tự có dấu không hợp lệ trong tiêu đề HTTP — lỗi này tồn tại từ trước ở cả tính năng xuất hóa đơn phòng trọ hàng tháng (chưa từng bị phát hiện vì trước đó chưa test đúng phòng có dấu). Đã sửa triệt để cho cả 2 nơi.

## Cập nhật mới (v6.0) — Sửa lỗi quan trọng: sửa Báo giá/Đơn mua chỉ hiện 1 dòng sản phẩm

- **Lỗi bạn báo cáo đã được xác nhận và sửa triệt để**: khi sửa Báo giá (hoặc tạo Đơn mua hàng từ Đơn bán) có từ 2 sản phẩm trở lên, hệ thống chỉ hiện đúng 1 dòng đầu tiên, các dòng còn lại biến mất — đồng thời đơn giá có số lẻ bị hiển thị sai (VD: 830.909 hiện thành 830.909.090.909).
- **Nguyên nhân gốc**: đoạn mã tự động nạp lại các dòng sản phẩm chạy quá sớm, trước khi thư viện xử lý ô chọn sản phẩm kịp tải xong, khiến chương trình bị dừng giữa chừng ngay từ dòng đầu tiên. Đây là lỗi đã tồn tại từ khi thêm tính năng gõ-tìm-kiếm sản phẩm (bản v3.8), nhưng chưa từng bị phát hiện vì cách tôi tự kiểm tra trước giờ chủ yếu qua dòng lệnh, không mô phỏng được đúng hành vi trình duyệt thật.
- **Đã sửa và kiểm tra kỹ bằng cách mô phỏng trình duyệt thật** (không chỉ kiểm tra qua dòng lệnh như thường lệ) cho cả 3 nơi bị ảnh hưởng: sửa Báo giá, tạo Đơn mua hàng từ Đơn bán, và sửa License — tất cả đều đã hiện đúng đầy đủ các dòng với số tiền chính xác.

## Cập nhật mới (v6.1) — Hợp đồng thuê trọ giờ theo PHÒNG, không theo từng người

- **Thay đổi quan trọng**: 1 hợp đồng = tất cả người đang ở CHUNG 1 phòng cùng ký (đúng thực tế bạn ký hợp đồng với cả phòng, không phải ký riêng từng người). Trước đây mỗi người có hợp đồng riêng — nay gộp lại theo phòng.
- Danh sách Hợp đồng, PDF xuất ra, và form sửa/gia hạn đều hiện đầy đủ thông tin của TẤT CẢ người đang ở trong phòng — PDF có dòng ký tên riêng cho từng người dưới "ĐẠI DIỆN BÊN B".
- Gán phòng cho người thuê mới: nếu phòng chưa có hợp đồng thì tự tạo 1 hợp đồng trống (vào "Hợp đồng thuê trọ" để điền tiếp); nếu phòng đã có hợp đồng, người mới tự động thuộc về hợp đồng đó, không tạo trùng.
- Gia hạn = tạo hợp đồng mới cho cả phòng (giữ nguyên người đang ở), hợp đồng cũ chuyển sang "đã nghỉ".
- Chấm dứt hợp đồng = chấm dứt luôn cho TẤT CẢ người trong phòng đó (vì hợp đồng là chung).
- **Dữ liệu hợp đồng cũ (nếu có, lưu theo từng người ở bản v5.9-v6.0) tự động gộp lại theo phòng khi nâng cấp** — nếu nhiều người trong cùng phòng có ngày/tiền cọc khác nhau, hệ thống lấy ngày xa nhất/tiền cọc lớn nhất làm giá trị chung; **bạn nên vào "Hợp đồng thuê trọ" kiểm tra lại sau khi nâng cấp** để chắc chắn đúng ý.

## Cập nhật mới (v6.2)

- **Sửa mẫu hợp đồng thuê trọ theo đúng thông tin thật**: dòng "Hôm nay ngày..." giờ để trống (bạn tự viết tay ngày ký), không tự điền ngày hôm nay nữa.
- Địa chỉ nhà trọ cố định: **207/45 Nam Cao, Phường Tăng Nhơn Phú, TP. Hồ Chí Minh** — áp dụng cho mọi chỗ cần địa chỉ trong hợp đồng.
- Thông tin chủ nhà trọ (Bên A) cập nhật đúng: **ngày sinh đầy đủ 04/04/1991** (trước chỉ có năm sinh), **nơi đăng ký HK: 66/95 Xô Viết Nghệ Tĩnh, Phường Thạnh Mỹ Tây, TP. Hồ Chí Minh**.
- Mục Cài đặt → Thông tin chủ nhà trọ đổi ô "Sinh năm" thành ô chọn ngày đầy đủ.
- **Máy đã cài từ trước sẽ tự động sửa đúng các thông tin trên khi nâng cấp** (chỉ sửa 1 lần duy nhất — nếu sau đó bạn tự sửa lại qua Cài đặt, hệ thống sẽ không ghi đè lại nữa).

## Cập nhật mới (v6.3) — Sửa lỗi hiển thị sai "Đã quá hạn"

- **Lỗi bạn báo cáo**: hợp đồng Phòng 2 hiện "Đã quá hạn" dù ngày hết hạn thực tế là 01/02/2027 — nguyên nhân do ngày lưu trong hệ thống bị sai thành năm **0027** thay vì **2027** (có thể do lúc nhập ngày, trình duyệt không tự thêm đủ số 0 phía trước khi gõ tắt năm).
- **Đã sửa dữ liệu sai hiện có tự động khi nâng cấp** — quét toàn bộ hợp đồng, phát hiện và sửa đúng các ngày bị lỗi dạng này.
- **Đã chặn để không lặp lại**: từ nay khi lưu/sửa/gia hạn hợp đồng, hệ thống tự kiểm tra và sửa đúng năm nếu phát hiện dạng lỗi tương tự trước khi lưu vào máy.

## Cập nhật mới (v6.4)

- **Sửa lỗi hiển thị 2 ô vuông sau tên người đại diện** trong PDF Hợp đồng (công ty) — nguyên nhân do dùng ký tự tab để canh khoảng cách, PDF không hiển thị được ký tự này. Đã thay bằng khoảng cách thường, hiển thị đúng và rõ ràng giữa tên và chức vụ.

## Cập nhật mới (v6.5)

- **Sửa lỗi "Xóa toàn bộ chuỗi liên quan"** (ở trang Báo giá) bỏ sót không xóa Hợp đồng liên quan — để lại bản ghi hợp đồng "mồ côi" trong hệ thống. Đã sửa: xóa chuỗi giờ xóa luôn cả Hợp đồng nếu có, thông báo kết quả cũng hiện rõ số hợp đồng đã xóa.
- **Xác nhận lại**: nút "Tạo hợp đồng" nằm ở trang **Đơn bán** (không phải trang Báo giá) — đã kiểm tra kỹ và xác nhận nút này luôn hiện lại đúng cho mọi đơn > 20 triệu, kể cả sau khi đã xóa hợp đồng cũ.

## Cập nhật mới (v6.6) — Đổi mẫu Hợp đồng công ty sang bản ngắn gọn hơn

- **Thay hoàn toàn mẫu hợp đồng cũ (15 điều, dài)** bằng mẫu mới ngắn gọn hơn nhiều (8 điều), dựa theo mẫu hợp đồng thực tế của đối tác KTC gửi.
- **Đổi vai trò A/B**: Bên A = IT Hoàn Hảo (bên bán), Bên B = khách hàng (bên mua) — đúng theo mẫu mới, khác với quy ước cũ.
- Bảng hàng hóa giờ hiện giá **đã gồm VAT trực tiếp** (đơn giản, dễ đọc hơn cho khách), không tách riêng dòng thuế suất như mẫu cũ.
- **Điều 3 (Bàn giao) đã bổ sung địa điểm giao hàng và số điện thoại người nhận** — lấy đúng từ thông tin bạn nhập khi tạo hợp đồng (nếu bỏ trống thì tự dùng địa chỉ công ty).
- Vẫn giữ đầy đủ các thông tin linh hoạt hệ thống đã có: tiến độ thanh toán tùy chỉnh, thời hạn bảo lãnh giá, số tháng bảo hành.
- Đổi nhãn trong form tạo hợp đồng từ "Thông tin Bên A (khách hàng)" thành "Thông tin Bên B (khách hàng)" cho đúng quy ước mới.

## Cập nhật mới (v6.7) — Tinh chỉnh mẫu Hợp đồng công ty

- **Sửa dòng "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" bị xuống dòng** — giờ nằm gọn 1 dòng.
- **Điền đúng số điện thoại công ty: 0775009101** — trước đó ô này bị để trống trong Cài đặt nên hợp đồng không hiện. Máy đã cài từ trước sẽ tự động điền đúng khi nâng cấp (chỉ 1 lần, không ghi đè nếu bạn đã tự nhập số khác).
- **Tăng khoảng cách giữa tên đại diện và "Chức vụ"** cho cả Bên A và Bên B, dễ đọc hơn.
- **Tách thông tin ngân hàng thành 3 dòng riêng biệt**: Ngân hàng / Tên tài khoản / Số tài khoản (trước đây gộp chung 1 dòng).

## Cập nhật mới (v6.8) — Cột Ghi chú trong Báo giá, hỗ trợ xuống dòng

- **Ô "Ghi chú thêm" khi tạo/sửa Báo giá giờ là ô nhiều dòng** — có thể viết xuống dòng thoải mái (VD: liệt kê từng đặc điểm sản phẩm).
- **PDF Báo giá xuất ra có thêm cột "Ghi chú" riêng** bên cạnh tên sản phẩm, hiển thị đúng xuống dòng như đã nhập — không bị dồn hết vào 1 dòng. Chiều cao mỗi dòng trong bảng tự giãn vừa đủ theo nội dung dài nhất (tên sản phẩm hoặc ghi chú).
- Dòng nhập tự do (không chọn sản phẩm có sẵn) vẫn hoạt động như cũ, không bị lặp nội dung ở cột Ghi chú.

## Cập nhật mới (v6.9) — Icon tick vàng đẹp mắt cho cột Ghi chú

- **Sửa lỗi ô vuông xấu trong cột Ghi chú**: các ký tự icon/emoji (VD ✅) dán từ nguồn khác vào không được font PDF hỗ trợ, hiện thành ô vuông. Đã sửa: hệ thống tự loại bỏ các ký tự emoji không tương thích, đồng thời **tự vẽ icon tick tròn màu vàng thật** ở đầu mỗi dòng ghi chú — đẹp, ổn định, không phụ thuộc font.
- Áp dụng cho mọi kiểu ghi chú: dù bạn gõ dấu "-", dán icon ✅ có sẵn, hay chỉ gõ chữ thường — đều tự động hiện đẹp với icon tick vàng đồng nhất.
- Icon canh đúng theo dòng đầu tiên của mỗi ý, kể cả khi ý đó dài phải xuống dòng.

## Cập nhật mới (v7.0) — Sửa lỗi nghiêm trọng + hoàn thiện cột Ghi chú + tải PDF trực tiếp

- **Sửa lỗi nghiêm trọng (regression)**: sau khi thêm cột Ghi chú (v6.8-v6.9), nếu Báo giá có nhiều sản phẩm/ghi chú dài khiến bảng dài quá 1 trang, phần Điều khoản phía dưới bị lỗi mỗi dòng 1 trang riêng, chữ chuyển màu cam. Đã tìm ra nguyên nhân (icon tick làm rò màu + thiếu kiểm tra sang trang an toàn), sửa tận gốc.
- **Sửa tiêu đề "BH (Tháng)" và "Thuế (%)"** bị vỡ dòng xấu — giờ mỗi tiêu đề gọn đúng 2 dòng.
- **Cột "Thiết bị" tự co giãn**: có Ghi chú thì thu hẹp nhường chỗ cho cột Ghi chú; không có Ghi chú thì tự rộng ra như trước, không có cột thừa.
- **Thêm nút "+ Thêm nhà cung cấp mới..."** trong modal Thêm sản phẩm mới — mở hộp thoại riêng nhập tên nhà cung cấp, không cần rời khỏi màn hình đang làm.
- **PDF giờ tải trực tiếp về máy**, không còn mở tab/cửa sổ Chrome mới trống trơn — áp dụng cho toàn bộ PDF trong hệ thống (Báo giá, Hóa đơn, Biên bản bàn giao, Đề nghị thanh toán, Hợp đồng, License, Nhà trọ...).

## Cập nhật mới (v7.1) — Sửa lỗi không lưu được Ngày ký khi sửa hợp đồng

- **Lỗi bạn báo cáo đã được xác nhận và sửa**: khi sửa hợp đồng và đổi "Ngày ký", bấm Lưu xong ngày vẫn hiện như cũ (không đổi). Nguyên nhân: khi làm mẫu hợp đồng mới (v6.6, có thêm ô "Ngày ký"), route lưu khi SỬA hợp đồng bị sót không cập nhật trường này (route tạo mới vẫn lưu đúng, chỉ route sửa bị thiếu).
- Đã sửa và test lại đúng số liệu như ảnh bạn gửi — đổi ngày ký thành 20/08/2026, lưu lại, cả trang chi tiết và PDF xuất ra đều hiện đúng ngày mới.

## Cập nhật mới (v7.2) — Wizard "Tạo đơn hàng", Trợ giúp, xóa chuỗi Đơn mua hàng

- **Mới: màn hình "Tạo đơn hàng" (Wizard)** — nút to trên Dashboard, dẫn dắt đúng 8 bước từ Báo giá đến Thanh toán, không cho bỏ qua bước (chặn cả giao diện lẫn máy chủ). Tự động bỏ qua bước Đặt/Nhận hàng NCC nếu đã đủ tồn kho. Dành cho cả nhân viên thao tác mà không cần nhớ quy trình. Menu "Quy trình bán hàng" cũ vẫn giữ nguyên để tra cứu/xử lý ngoại lệ.
- **Mới: trang Trợ giúp** (icon "?" cạnh icon Cài đặt) — xem số phiên bản, nhật ký cập nhật, hướng dẫn sử dụng có sơ đồ trực quan.
- **Mới: "Xóa toàn bộ chuỗi liên quan" cho Đơn mua hàng** — trước đây đơn mua hàng đã nhận hàng thì không xóa được (báo lỗi khó hiểu). Giờ có thể xóa cả chuỗi (tự hoàn tác tồn kho), nhưng hệ thống sẽ tự chặn nếu hàng đã lỡ giao cho khách rồi để tránh sai lệch số liệu.
- **Sửa lỗi bạn báo cáo**: không thêm được sản phẩm mới khi tạo/sửa Báo giá — do 1 thẻ đóng script bị dư thừa khiến đoạn code xử lý hiện ra thành chữ thay vì chạy được. Đã sửa.

## Những gì CHƯA có ở bản MVP này (dự kiến bổ sung sau)

- Đổi mật khẩu qua giao diện
- Nhiều tài khoản người dùng / phân quyền theo vai trò
- Bảo hành, License phần mềm
- Đính kèm file (hóa đơn NCC, hợp đồng...)
- Xuất Excel/PDF cho báo cáo (hiện chỉ xem trên web)
- Nhắc nhở tự động (công nợ quá hạn, tồn kho thấp) — hiện chỉ hiển thị khi vào Dashboard/Báo cáo

Những mục trên không ảnh hưởng đến việc sử dụng hệ thống ngay hôm nay — sẽ bổ sung dần ở các phiên bản tiếp theo.
