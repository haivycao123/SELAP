# Script thuyết trình tiếng Việt cho slide SELAP

Nguồn tham chiếu:
- PDF slide: `D:\Downloads\Introduction to Software Engineering.pdf`, 28 slide.
- Source code hiện tại trong repo: Next.js frontend, NestJS backend, Prisma/PostgreSQL.
- Kiểm tra nhanh backend: `npm test -- --runInBand` trong `src/backend` pass 1 test suite, 1 test case.

Gợi ý cách dùng:
- Mỗi slide có phần "Lời thoại" để đọc hoặc diễn giải trực tiếp.
- Phần "Nhấn mạnh" là ý cần bám khi bị hỏi thêm hoặc khi muốn nói sâu hơn.
- Nếu thời gian ngắn, ưu tiên nói kỹ các slide 3, 4, 8, 11, 12, 13, 17-25, 26.

## Slide 1. SELAP Presentation

### Lời thoại

Xin chào thầy/cô và các bạn. Hôm nay nhóm em xin trình bày về project SELAP, một hệ thống web quản lý bán hàng bất động sản theo thời gian thực.

Điểm quan trọng của SELAP là sản phẩm không chỉ dùng để đăng và xem tin bất động sản. Nhóm em xây dựng SELAP theo hướng một nền tảng vận hành nội bộ cho doanh nghiệp bất động sản vừa và nhỏ: quản lý kho bất động sản, quản lý nhân sự sale, phân vùng phụ trách, tiếp nhận yêu cầu từ khách hàng, và xử lý quyền sở hữu lead một cách minh bạch.

Trong phần trình bày, nhóm em sẽ đi theo 5 phần chính: vấn đề thực tế, định vị sản phẩm, yêu cầu và thiết kế, bằng chứng cài đặt, cuối cùng là chiến lược kiểm thử và demo sản phẩm.

### Nhấn mạnh

Mở đầu nên nói rõ SELAP là "Real Estate Sales Management Web Application", không phải chỉ là website listing. Từ khóa nên lặp lại: centralized, real-time, role-based, regional assignment.

## Slide 2. Our Team

### Lời thoại

Đây là thành viên của nhóm em. Nhóm gồm 4 thành viên: Cao Hải Vy, Nguyễn Lâm Thảo Trang, Nguyễn Thanh Nguyên và Huỳnh Mai Trâm.

Trong project, chúng em chia việc theo từng mảng rõ ràng nhưng vẫn hỗ trợ chéo cho nhau. Phần phân tích nghiệp vụ và lập kế hoạch sprint do bạn Cao Hải Vy phụ trách chính. Phần backend API, kiểm thử chức năng và kiểm thử tích hợp do bạn Nguyễn Lâm Thảo Trang phụ trách chính. Phần giao diện Next.js, liên kết dữ liệu và database schema do bạn Nguyễn Thanh Nguyên phụ trách chính. Phần UI screen, luồng người dùng và tính dễ sử dụng của giao diện do bạn Huỳnh Mai Trâm hỗ trợ chính.

Lý do nhóm chia như vậy là vì SELAP có cả nghiệp vụ, backend realtime, database và frontend role-based, nên mỗi thành viên có một phạm vi chính, đồng thời vẫn cần review qua lại để sản phẩm cuối cùng thống nhất.

### Nhấn mạnh

Không chỉ đọc tên. Hãy nói "primary ownership" để thầy/cô thấy được team có quản lý công việc.

## Slide 3. Problem Statement

### Lời thoại

Vấn đề mà SELAP giải quyết đến từ cách các doanh nghiệp bất động sản vừa và nhỏ đang vận hành hằng ngày.

Trong thực tế, thông tin bất động sản thường bị phân tán ở nhiều nơi: file Excel, tin nhắn Zalo, Telegram, Google Sheet, hoặc các nền tảng đăng tin riêng lẻ. Khi dữ liệu bị phân tán, một căn hộ đã đặt cọc hoặc đã bán có thể vẫn được một sale khác giới thiệu cho khách. Điều này làm khách hàng nhận thông tin cũ, sale mất thời gian, và doanh nghiệp mất uy tín.

Vấn đề thứ hai là trạng thái bất động sản không được đồng bộ theo thời gian thực. Nếu admin hoặc sale cập nhật trạng thái "Deposited" hay "Hidden", khách hàng đã lưu bất động sản đó cần được thông báo. Nếu không có cơ chế thông báo, khách vẫn tiếp tục hỏi về sản phẩm không còn phù hợp.

Vấn đề thứ ba là phân chia lead thủ công. Khi một khách hàng gửi yêu cầu tư vấn, nhiều sale có thể cùng muốn nhận lead đó. Nếu không có cơ chế claim minh bạch, sẽ phát sinh tranh chấp: ai thấy trước, ai được giao, ai có quyền liên hệ khách.

Cuối cùng, quản lý thiếu công cụ để phân công sale theo khu vực. Bất động sản thường phụ thuộc vào địa bàn, vì vậy việc agent nào phụ trách quận nào, lead nào thuộc khu vực nào, và hiệu quả từng sale theo vùng cần được quản lý có cấu trúc.

### Nhấn mạnh

Liên kết trực tiếp với sản phẩm: SELAP dùng Region/AgentRegion để phân vùng, Notification để đồng bộ thông tin, Lead/LeadClaim để tránh tranh chấp lead.

## Slide 4. Product Positioning

### Lời thoại

Từ những vấn đề đó, nhóm em định vị SELAP là một nền tảng web quản lý bất động sản tập trung. Sản phẩm gồm các nhóm dữ liệu chính: properties, users, regions, favorites, leads và notifications.

SELAP có 3 điểm khác biệt. Thứ nhất là centralized repository, tức là tất cả thông tin quan trọng nằm trong một nguồn dữ liệu chung. Property, user, agent profile, region, favorite, lead và notification đều được lưu trong PostgreSQL thông qua Prisma ORM, giúp backend đọc và cập nhật dữ liệu nhất quán.

Thứ hai là real-time lead sharing. Khi customer bấm "Request consultation" ở trang chi tiết bất động sản, backend tạo một lead mới và Socket.IO gateway phát sự kiện `new_lead` đến phòng của khu vực tương ứng. Sales Agent trong khu vực đó có thể thấy lead gần như ngay lập tức.

Thứ ba là regional partitioning. Sales Agent không được xem và quản lý tất cả mọi thứ. Agent chỉ nhận lead và quản lý property trong các Region được Admin gán. Điều này vừa giảm nhiễu thông tin thừa, vừa phù hợp với cách doanh nghiệp bất động sản chia địa bàn.

Nói ngắn gọn, SELAP giúp đội sale bất động sản giảm dữ liệu rời rạc, giảm tranh chấp lead, và phản hồi khách hàng nhanh hơn bằng một hệ thống centralized, role-based và real-time.

### Nhấn mạnh

Dùng 3 cụm từ: one source of truth, real-time lead sharing, regional partitioning.

## Slide 5. Target Users And Value Proposition

### Lời thoại

SELAP có 3 nhóm người dùng chính.

Nhóm thứ nhất là Administrator. Admin cần kiểm soát user, duyệt Sales Agent, gán khu vực làm việc, quản lý danh sách nhân sự và quản lý bất động sản. Trong sản phẩm thực tế, Admin có navigation riêng gồm Catalog, Add Property, Staff Directory và Pending Agents. Điều này cho thấy Admin được thiết kế như vai trò vận hành và kiểm soát hệ thống.

Nhóm thứ hai là Sales Agent. Agent cần quản lý listing trong khu vực được phân công, nhận lead mới, claim lead nhanh, và theo dõi trạng thái chăm sóc khách. Trong giao diện, Sales Agent có Lead Inbox, Catalog, Add Property và badge hiển thị khu vực đang phụ trách.

Nhóm thứ ba là Customer. Customer cần tìm kiếm bất động sản, lọc theo khu vực, giá, loại căn hộ, lưu favorite và gửi yêu cầu tư vấn. Sau khi lead được agent chấp nhận, customer nhận notification để biết sẽ có người liên hệ.

Điểm em muốn nhấn mạnh là mỗi nhóm người dùng có giá trị riêng, nhưng tất cả đều nối vào cùng một workflow: property được quản lý đúng vùng, customer gửi nhu cầu, agent đúng vùng nhận lead, và admin kiểm soát toàn bộ qua account status và region assignment.

### Nhấn mạnh

Nói sản phẩm theo góc nhìn "ai dùng, dùng để làm gì, nhận giá trị gì".

## Slide 6. Project Management And Team Structure

### Lời thoại

Slide này thể hiện cách nhóm em tổ chức công việc.

Bạn Cao Hải Vy đảm nhận vai trò Project Lead và Business Analyst, phụ trách lập kế hoạch sprint, phân tích yêu cầu, điều phối tiến độ và hỗ trợ backend API.

Bạn Nguyễn Lâm Thảo Trang phụ trách backend và QA testing, tập trung vào REST API, xây dựng test plan, test chức năng, test tích hợp và các kịch bản automation với Katalon Studio.

Bạn Nguyễn Thanh Nguyên phụ trách frontend và database design, gồm giao diện Next.js, tích hợp fetch client, thiết kế schema Prisma và các quan hệ dữ liệu như User, Region, Property, Lead, Notification.

Bạn Huỳnh Mai Trâm hỗ trợ frontend và UI/UX, tập trung vào các màn hình người dùng, luồng điều hướng, responsive layout và tính dễ dùng khi demo.

Nhóm em không chỉ chia việc theo tên công nghệ, mà chia theo dòng giá trị của sản phẩm: ai phụ trách nghiệp vụ, ai phụ trách API, ai phụ trách dữ liệu, ai phụ trách trải nghiệm người dùng.

### Nhấn mạnh

Nếu bị hỏi về teamwork, nói "mỗi thành viên có owner rõ, nhưng các phần có review chéo qua sprint".

## Slide 7. Agile/Scrum Workflow

### Lời thoại

Nhóm em sử dụng Agile/Scrum với 4 sprint. Mỗi sprint tạo ra một increment có thể review được.

Sprint 1 từ ngày 22 Jun đến 4 Jul 2026 là giai đoạn foundation và authentication. Ở sprint này nhóm em làm requirement, bắt đầu Figma/UI, khởi tạo NestJS và Next.js, đồng thời xây dựng các chức năng nền tảng như JWT, OTP email verification và RBAC.

Sprint 2 từ ngày 6 Jul đến 18 Jul 2026 tập trung vào core business. Đây là lúc sản phẩm bắt đầu có catalog bất động sản, CRUD management, admin approval và region assignment. Nói cách khác, đây là sprint đưa dữ liệu bất động sản và vai trò admin/sale vào hệ thống.

Sprint 3 từ ngày 20 Jul đến 1 Aug 2026 tập trung vào real-time layer. Nhóm em bổ sung favorites, notifications, Socket.IO gateway và lead claiming. Đây là sprint tạo ra điểm khác biệt lớn nhất của SELAP: lead được phát theo khu vực và agent có thể claim theo thời gian thực.

Sprint 4 từ ngày 3 Aug đến 15 Aug 2026 là QA và delivery. Nhóm em hoàn thiện test plan, Katalon scenarios, performance checks, deployment preparation và demo materials.

Về công cụ, nhóm em dùng Jira để quản lý backlog và sprint tracking, GitHub để quản lý version control, và mỗi sprint đều có sản phẩm có thể review thay vì chỉ làm tài liệu.

### Nhấn mạnh

Kể theo logic build-up: auth -> business -> realtime -> testing/delivery.

## Slide 8. Software Requirements: Use Case Model

### Lời thoại

Slide này mô tả use case theo 3 lane ứng với 3 vai trò trong hệ thống.

Với Administrator, workflow bắt đầu từ Auth + OTP để đăng nhập an toàn. Sau đó Admin có thể duyệt hoặc từ chối Sales Agent, gán agent vào service area, quản lý property và theo dõi operations như staff và notifications. Trong code, các chức năng này tương ứng với module Admin và các route như `/admin/agents/pending`, `/admin/agents/:id/approve`, `/admin/regions`, `/admin/staff`.

Với Sales Agent, điều kiện đầu tiên là account phải được approve. Nếu account còn pending, login sẽ bị chặn. Khi đã active, agent có thể quản lý property trong vùng được assign, nhận `new_lead` event, bấm Accept để claim lead, sau đó theo dõi lead và cập nhật trạng thái follow-up như Contacted, Qualified, Converted, Lost.

Với Customer, workflow đi theo hành trình người mua hoặc người thuê nhà: đăng ký, verify email, đăng nhập, browse catalog, lọc bất động sản, save favorite, request consultation và nhận notification khi lead được agent chấp nhận.

Điểm thiết kế quan trọng ở đây là mỗi lane không tách rời nhau. Customer tạo lead, Region route lead đến Sales Agent, Agent claim lead, và Admin quản lý điều kiện để Agent có quyền tham gia workflow đó.

### Nhấn mạnh

Nói rõ "role-based use case" và "RBAC check" vì đây là điểm software engineering, không chỉ UI.

## Slide 9. Core Functional Requirements

### Lời thoại

Những functional requirements cốt lõi của SELAP gồm 6 nhóm.

Thứ nhất là authentication. User đăng ký bằng name, email, phone, password và role. Email và phone là duy nhất. Hệ thống gửi mã OTP 4 chữ số qua email, mã có thời hạn 10 phút. Sau khi verify email, user mới đăng nhập được.

Thứ hai là RBAC và account status. Backend dùng JWT để bảo vệ API. Khi login, user phải chọn đúng role của account. Nếu chọn sai role, hệ thống báo lỗi. Nếu email chưa verify, hệ thống chặn. Nếu Sales Agent còn `PENDING`, login cũng bị chặn với thông báo "Account is pending and cannot log in."

Thứ ba là property management. Admin quản lý toàn bộ property, còn Sales Agent chỉ quản lý property trong region được gán. Property có title, description, type, status, price, area, address, city, district, ward, bedroom, bathroom, floor, images và status history.

Thứ tư là public catalog. Customer và guest có thể xem danh sách bất động sản, search theo từ khóa, lọc theo location, type, price, area và status hiển thị. Frontend có filter bar với Search, Area, Min/Max price, Type và nút Filter.

Thứ năm là favorites và notifications. Customer có thể save property vào Favorites. Khi property được save, hệ thống tạo notification. Khi status property thay đổi, những user đã favorite property đó sẽ nhận notification.

Thứ sáu là real-time lead claiming. Customer request consultation từ trang detail. Eligible Sales Agents trong region nhận lead, nhưng thông tin liên hệ của customer bị ẩn. Agent nào Accept thành công trước thì mới được mở tên, phone và email của customer.

### Nhấn mạnh

Nếu cần nói ngắn: auth có OTP + RBAC, property có region scope, lead claiming có realtime + atomic transaction.

## Slide 10. Non-Functional Requirements

### Lời thoại

Ngoài chức năng, nhóm em đặt ra các non-functional requirements để sản phẩm có thể vận hành ổn định.

Về performance, core API responses được đặt mục tiêu dưới 500 ms trong điều kiện bình thường. Với real-time, lead và notification nên được đẩy đến người dùng trong vòng 1 giây, kể cả trong kịch bản có 100 user đồng thời.

Về security, backend dùng JWT access token, role checks, account status validation, email verification và secure password hashing. Trong implementation hiện tại, password được hash bằng Node.js `scrypt`, là hàm hash mật khẩu an toàn và phù hợp với yêu cầu bảo mật.

Về data consistency, yêu cầu quan trọng nhất là một lead chỉ được claim một lần. Nếu hai Sales Agent bấm Accept gần như cùng lúc, database và transaction phải đảm bảo chỉ một người thắng, người còn lại nhận trạng thái lead đã đóng.

Về maintainability, backend đi theo modular monolith. Các module Auth, Admin, Properties, Favorites, Notifications, Leads và Claiming được tách theo domain. Cách này giúp project nhỏ và vừa dễ deploy như một backend duy nhất, nhưng code vẫn rõ trách nhiệm.

Về portability, kiến trúc phù hợp để deploy frontend lên Vercel, backend lên Render hoặc Railway, và database dùng Supabase PostgreSQL.

### Nhấn mạnh

Dùng cụm "design target" nếu bị hỏi về performance, vì slide đang nói mục tiêu và quality gate, không phải tất cả đều là benchmark sản xuất.

## Slide 11. Architecture: Modular Monolithic System

### Lời thoại

Đây là kiến trúc tổng thể của SELAP.

Phía người dùng là Browser, gồm Admin, Sales Agent và Customer. Giao diện được xây dựng bằng Next.js 15 và React 19. Next.js đảm nhận pages, components, role-based navigation và frontend fetch client.

Giữa frontend và backend có Next API Routes. Lớp này đóng vai trò proxy và helper cho frontend, giúp frontend gọi các endpoint thông qua `/api/...`, đồng thời gửi token khi cần authenticated request.

Backend là NestJS modular monolith. Các REST controllers được tách theo domain như Auth, Admin, Properties, Favorites, Notifications và Leads. Controller nhận request, service xử lý business rules, permission và transaction.

Dữ liệu được truy cập qua Prisma ORM, sau đó lưu vào Supabase PostgreSQL. Database gồm Users, Properties, Regions, Leads, Notifications và các bảng quan hệ như AgentRegion, Favorite, LeadClaim.

Ngoài REST API, SELAP có real-time layer là ClaimingGateway dùng Socket.IO namespace `/claiming`. Gateway này chia phòng theo `user_{id}` và `region_{id}`. Nhờ vậy customer có thể nhận `lead_accepted`, còn agent trong khu vực có thể nhận `new_lead` và `lead_claimed`.

Cuối cùng, hệ thống có SMTP cho OTP email và reset password, đồng thời có upload storage local cho ảnh bất động sản qua endpoint `/properties/uploads/images`.

### Nhấn mạnh

Giải thích lý do modular monolith: đơn giản deploy cho project môn học, nhưng vẫn tách module theo domain để maintainable.

## Slide 12. Design Highlight: Real-Time Lead Claiming

### Lời thoại

Đây là thiết kế quan trọng nhất của SELAP: real-time lead claiming.

Bước 1, Customer vào trang detail của một property và bấm "Request consultation". Frontend gọi `POST /leads` kèm `propertyId` và note. Backend kiểm tra customer tồn tại, property tồn tại, và property không được ở trạng thái `DEPOSITED` hoặc `SOLD`.

Bước 2, backend tạo Lead mới với status `NEW`. Lead này lấy `regionId` từ property, vì lead phải được route theo khu vực bất động sản.

Bước 3, nếu property có region, `ClaimingGateway` broadcast sự kiện `new_lead` đến room `region_{regionId}`. Chỉ các Sales Agent đã được gán vùng đó mới ở trong room này.

Bước 4, nhiều agent có thể cùng thấy lead và bấm Accept. Trên UI, lead mới hiện là "New Consultation Request - Accept to view", nghĩa là thông tin tên và số điện thoại khách đang bị che để đảm bảo công bằng và bảo mật.

Bước 5, khi agent gọi `POST /leads/{id}/claim`, backend kiểm tra agent phải active, phải có AgentProfile, và nếu lead có region thì agent phải nằm trong region đó. Sau đó backend chạy database transaction: update lead từ `NEW` sang `CLAIMED`, gán `assignedAgentId`, set `claimedAt`, và tạo record `LeadClaim`.

Bước 6, database đảm bảo chỉ một claim thành công bằng unique constraint trên `LeadClaim.leadId` và điều kiện lead vẫn còn `NEW`. Agent thắng cuộc được mở contact info của customer. Các agent còn lại nhận `lead_claimed` và UI đóng nút Accept. Customer nhận notification `LEAD_ACCEPTED` và event `lead_accepted`.

Đây là điểm SELAP biến bài toán "ai lấy lead trước" từ một tranh chấp thủ công thành một transaction minh bạch, có realtime feedback và có bảo vệ dữ liệu khách hàng.

### Nhấn mạnh

Dùng từ "atomic claim": transaction + unique LeadClaim + status NEW.

## Slide 13. Database Schema Overview

### Lời thoại

Slide này tóm tắt schema database được implement bằng Prisma và PostgreSQL.

Trung tâm là bảng `User`. User có role `ADMIN`, `SALES_AGENT`, `CUSTOMER`, có account status như `PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`, và có các trường bảo mật như email verification code, password reset code, reset token.

Với Sales Agent, `User` liên kết 1-1 với `AgentProfile`. `AgentProfile` liên kết 1-n với `AgentRegion`, và `AgentRegion` nối đến `Region`. Quan hệ này cho phép một agent phụ trách nhiều khu vực, và một khu vực có nhiều agent.

`Region` lại liên kết với `Property` và `Lead`. Nhờ vậy, khi một property thuộc khu vực nào, consultation request từ property đó cũng có thể được route đến đúng agent trong khu vực.

`Property` là bảng quản lý inventory. Property có images thông qua `PropertyImage`, có audit trail thông qua `PropertyStatusHistory`, và có quan hệ với `Favorite` khi customer save property.

`Favorite` nối User và Property, có unique constraint trên cặp user-property để một user không save trùng cùng một property.

`Lead` lưu yêu cầu tư vấn, gồm tên và phone customer, source, status, propertyId, regionId và assignedAgentId. `LeadClaim` là bảng khóa logic claim, trong đó `leadId` là unique. Đây là điểm bảo đảm một lead chỉ có một claim thành công.

`Notification` lưu các thông báo như account approved, account rejected, property status changed, property saved và lead accepted. Notification có `readAt` để frontend tính unread count và mark as read.

Một lưu ý nhỏ là trong tài liệu PA có thể dùng thuật ngữ "Area" và "LeadRequest", còn implementation hiện tại đặt tên là `Region` và `Lead`. Về nghiệp vụ chung là tương đương, nhưng khi giải thích code nên dùng đúng tên trong schema.

### Nhấn mạnh

Nếu bị hỏi "database có gì đảm bảo không claim trùng?", trả lời: `LeadClaim.leadId` unique + transaction update lead còn status `NEW`.

## Slide 14. Implementation Evidence

### Lời thoại

Slide này tổng hợp bằng chứng implementation từ source code hiện tại.

Phần Authentication đã có registration, email verification, login, password recovery, reset token và `/auth/me`. Frontend có các màn hình `/auth/login`, `/auth/register`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`. Backend có AuthController và AuthService để validate email, phone, password, role và account status.

Phần Admin đã có pending Sales Agent approval, rejection, region assignment và staff directory. Admin có thể vào Pending Agents, chọn area cho agent, bấm Approve để chuyển agent thành `ACTIVE`, hoặc Reject kèm reason. Staff Directory hiện tổng quan admin, sales agents, active, pending, vùng được gán và thống kê properties/leads.

Phần Property đã có public listing, detail view, management view, image upload, filtering, status history và notification khi favorite property thay đổi trạng thái. Admin quản lý toàn bộ, Sales Agent chỉ quản lý property trong region được gán.

Phần Lead đã có create consultation request, view available leads, claim lead, view assigned leads và update lead status. Agent có tab "Real-time Inbox" và "My Assigned Leads".

Phần Realtime đã có Socket.IO namespace `/claiming`, JWT-authenticated connection, region rooms, user rooms, và các event `new_lead`, `lead_claimed`, `lead_accepted`.

Nói cách khác, slide này chứng minh các yêu cầu không chỉ nằm trên tài liệu. Chúng đã được gắn vào controller, service, schema database và màn hình frontend cụ thể.

### Nhấn mạnh

Có thể kể nhanh tên màn hình thực tế: Login, Register, Verify Email, Catalog, Property Detail, Favorites, Notifications, Property Management, Pending Agents, Staff Directory, Lead Inbox.

## Slide 15. Testing Strategy And QA Pyramid

### Lời thoại

Với testing, nhóm em dùng QA pyramid để phân bổ công sức kiểm thử.

Tầng đáy là Unit Tests, chiếm 60%. Mục tiêu là kiểm tra nhanh các service, guard, DTO validation, utility và business rules. Vì backend có nhiều rule như validate phone, validate password, account status, region permission, lead status, nên unit test giúp bắt lỗi sớm.

Tầng giữa là Integration/API Testing, chiếm 25%. Mục tiêu là kiểm tra các module khi làm việc với nhau: REST endpoint, Prisma database behavior, transaction và lead-claim consistency. Phần này phù hợp với Jest, Supertest và Prisma test DB.

Tầng trên là E2E/UI Testing, chiếm 15%. Ở đây nhóm em dùng Katalon Studio và có thể mở rộng bằng Playwright/Cypress để kiểm tra hành trình thật của người dùng trên browser.

Ngoài pyramid, nhóm em có performance testing targeted cho các điểm rủi ro cao: API latency, WebSocket latency và concurrent lead claiming. Đây không phải test tất cả màn hình, mà tập trung vào nơi nếu lỗi sẽ ảnh hưởng trực tiếp đến giá trị sản phẩm.

Theo PA3, nhóm em lập kế hoạch 130 test cases, bao phủ Auth, Admin/Region, Property, Favorites và Lead Management. Critical risk focus là concurrent lead claiming, RBAC restrictions, property consistency và real-time notification latency.

### Nhấn mạnh

Testing không chỉ để bắt bug UI. Testing ở đây bảo vệ các risk nghiệp vụ quan trọng của SELAP.

## Slide 16. Testing Strategy And QA Pyramid Table

### Lời thoại

Slide này chi tiết hóa từng cấp test, mục đích và công cụ.

Với Unit Testing 60%, nhóm em dùng Jest để validate services, guards, DTOs, utilities và business rules. Vì các rule như "Sales Agent pending không được login" hay "phone phải đúng format" có thể test nhanh mà không cần mở browser.

Với Integration/API Testing 25%, nhóm em dùng Jest, Supertest, Prisma test DB và có thể dùng Postman/Bruno để kiểm tra endpoint. Phần này quan trọng với các API như `POST /auth/login`, `GET /properties`, `POST /admin/agents/:id/approve`, `POST /leads/{id}/claim`.

Với E2E/UI Testing 15%, nhóm em dùng Katalon Studio để mở browser, thao tác như người dùng thật, rồi verify toast, redirect, danh sách property, empty state và kết quả PASS.

Với Performance Testing, nhóm em đặt mục tiêu targeted, có thể dùng k6, Locust hoặc scripted Socket.IO/API clients. Kịch bản cần quan tâm nhất là 100 users cùng nhận notification hoặc nhiều agents cùng claim một lead.

Pie chart bên phải cho thấy tỷ trọng kiểm thử: phần lớn là unit để phản hồi nhanh, phần tiếp theo là API/integration để đảm bảo module làm việc đúng, và phần E2E nhỏ hơn nhưng tập trung vào critical user journeys.

### Nhấn mạnh

Nếu thời gian ít, nói theo 3 cấp: test logic nhanh, test API/database, test browser journeys.

## Slide 17. Automation Testing With Katalon Studio - Test Case 1

### Lời thoại

Test case đầu tiên là "Valid Customer Sign In", một positive scenario.

Mục tiêu của test này là xác minh một customer active có thể đăng nhập thành công vào hệ thống. Katalon sẽ mở browser, vào trang `/auth/login`, chọn role Customer, nhập phone number và password hợp lệ, sau đó bấm Sign In.

Sau khi submit, test kiểm tra hai kết quả. Thứ nhất, UI phải hiện success toast với nội dung "Signed in successfully! Redirecting...". Thứ hai, trang phải điều hướng sang property listing page, tức là `/properties`.

Giá trị của test này không chỉ là kiểm tra nút Sign In. Nó xác nhận flow authentication end-to-end: frontend gửi request đến API login, backend validate phone-password-role, trả về access token, frontend lưu token vào localStorage và redirect người dùng đến catalog.

Trong sản phẩm SELAP, đây là cửa vào của Customer. Nếu Customer không đăng nhập ổn định, các workflow phía sau như Save Favorites, Request Consultation và Notifications sẽ không hoạt động.

### Nhấn mạnh

Nói "positive scenario" và "authentication gateway for customer workflows".

## Slide 18. Automation Testing With Katalon Studio - Test Case 1 Evidence

### Lời thoại

Đây là bằng chứng chạy từ Katalon Studio cho test case 1.

Bên trái là Tests Explorer, chúng ta thấy test case `TC_AUTO_01_SignIn_Customer_Success`. Ở giữa là script tự động hóa: mở browser, navigate đến `http://localhost:3000/auth/login`, chọn role Customer, nhập credentials, submit form, verify toast và verify page redirection.

Bên phải, phần Job Progress được khoanh đỏ hiển thị trạng thái Passed. Ở console phía dưới cùng, test case này có 15 test steps và tất cả 15 steps đều Passed, duration khoảng 8.531 seconds.

Điều này cho thấy flow đăng nhập Customer đã được kiểm tra bằng automation browser, không chỉ test thủ công. Khi demo, nếu đăng nhập customer thành công và vào Catalog, đây chính là hành vi mà Katalon đã verify.

### Nhấn mạnh

Chỉ vào 3 vùng: test case name, script steps, Passed result.

## Slide 19. Automation Testing With Katalon Studio - Test Case 2

### Lời thoại

Test case thứ hai là "Pending Sales Agent Sign In Blocked", một negative scenario.

SELAP có rule nghiệp vụ quan trọng: Sales Agent tự đăng ký sẽ không được vào hệ thống ngay. Account của agent bắt đầu với status `PENDING` và phải được Admin duyệt, đồng thời gán khu vực phụ trách, mới có quyền đăng nhập.

Katalon test sẽ mở trang `/auth/login`, chọn role Sales Agent, nhập thông tin của một account đang pending, rồi bấm Sign In. Kết quả mong đợi là backend từ chối login và frontend hiện lỗi phù hợp.

Trong code backend, AuthService kiểm tra nếu user status khác `ACTIVE` thì ném ForbiddenException với thông điệp dạng "Account is pending and cannot log in." UI sẽ hiện message này trên màn hình hoặc toast.

Test này rất quan trọng vì nó bảo vệ hệ thống khỏi việc agent chưa được xác thực vẫn có thể truy cập lead, customer contact hoặc inventory. Nó cũng đảm bảo Admin là người kiểm soát vùng phụ trách trước khi agent bắt đầu nhận lead.

### Nhấn mạnh

Đây là security/RBAC test, không phải chỉ test đăng nhập sai.

## Slide 20. Automation Testing With Katalon Studio - Test Case 2 Evidence

### Lời thoại

Đây là evidence của test case 2 trong Katalon.

Test case có tên `TC_AUTO_02_SignIn_PendingAgent_Blocked`. Script thể hiện rõ các bước: navigate đến login page, chọn Sales Agent role, input credentials của pending account, submit form, verify error notification và verify URL vẫn ở login page.

Bên phải có Job Progress hiện Passed. Phía dưới console cho thấy 12 test steps đều Passed, duration khoảng 6.415 seconds.

Ý nghĩa của ảnh này là SELAP xử lý đúng negative flow: hệ thống không cho pending agent đăng nhập, nhưng cũng trả về thông báo rõ ràng cho người dùng. Điều này cần thiết vì agent approval là một phần trong quy trình vận hành, không phải tùy chọn UI.

### Nhấn mạnh

Liên kết với Admin approval: agent phải qua Pending Agents và được assign area trước khi active.

## Slide 21. Automation Testing With Katalon Studio - Test Case 3

### Lời thoại

Test case thứ ba là "Filter Properties by Area", một positive scenario cho catalog.

Mục tiêu là kiểm tra khi người dùng chọn một Area trong filter bar, danh sách bất động sản cập nhật và hiện các property card phù hợp.

Trong sản phẩm hiện tại, filter Area trên frontend thực chất là lọc theo khu vực địa lý, cụ thể là city và district lấy từ danh sách Region public options. Khi user chọn một area và bấm Filter, frontend tạo query parameters gửi đến API `/properties`, backend build where condition theo city/district, sau đó trả về danh sách property và meta pagination.

Katalon mở trang `/properties`, chọn Area, bấm Filter, rồi verify kết quả. Nếu có property phù hợp, UI hiện card với title, price, area, bedroom/city và status. Đồng thời frontend hiện toast "Filtered successfully! Found ... properties." để xác nhận thao tác lọc đã chạy.

Giá trị nghiệp vụ của test này là customer có thể tìm nhà theo khu vực quận/huyện, đây là hành vi rất thực tế trong bất động sản. Nếu filter sai, customer sẽ mất thời gian và lead tạo ra cũng kém chất lượng.

### Nhấn mạnh

Nói rõ Area trong test là khu vực/district, không phải diện tích m2.

## Slide 22. Automation Testing With Katalon Studio - Test Case 3 Evidence

### Lời thoại

Đây là evidence của test case lọc property theo Area.

Test case có tên `TC_AUTO_03_Filter_Properties_By_Area`. Script mở Catalog page ở `http://localhost:3000/properties`, input area filter, verify matching results và verify success toast.

Bên phải, Job Progress hiện Passed. Console phía dưới cho thấy 9 test steps đều Passed, duration khoảng 7.336 seconds.

Ảnh này chứng minh flow catalog filtering đã được tự động hóa trên browser thật. Khi người dùng thấy danh sách property thay đổi sau khi chọn Area, đó không chỉ là filter trên UI, mà là kết quả của frontend gọi API và backend truy vấn dữ liệu theo điều kiện khu vực.

### Nhấn mạnh

Nói "UI + API + database query" để tăng giá trị kỹ thuật của test.

## Slide 23. Automation Testing With Katalon Studio - Test Case 4

### Lời thoại

Test case thứ tư là "Filter Properties Empty State", một negative scenario cho catalog.

Một hệ thống search/filter tốt không chỉ cần trả về kết quả khi có dữ liệu, mà còn phải xử lý đúng khi không có property nào khớp điều kiện. Nếu không có empty state rõ ràng, user sẽ không biết là hệ thống đang lỗi, đang loading hay thực sự không có kết quả.

Trong test này, Katalon nhập một tiêu chí không tồn tại, ví dụ keyword hoặc filter không khớp với dữ liệu hiện có, sau đó bấm Filter. Kết quả mong đợi là UI hiện thông báo empty state "No properties match these filters." Đồng thời có thể có toast báo đã filter thành công và found 0 properties.

Về mặt backend, API vẫn phải trả về response hợp lệ với `data` rỗng và pagination meta, chứ không được trả lỗi 500. Về mặt frontend, trang phải hiện empty state thân thiện và không bị vỡ layout.

Test này bảo vệ trải nghiệm người dùng trong trường hợp không có kết quả, một tình huống rất thường gặp khi customer tìm theo khu vực/gia/loại căn hộ quá hẹp.

### Nhấn mạnh

Negative scenario tốt là hệ thống xử lý "không có kết quả" một cách dự đoán được.

## Slide 24. Automation Testing With Katalon Studio - Test Case 4 Evidence

### Lời thoại

Đây là evidence của test case empty state.

Test case có tên `TC_AUTO_04_Filter_Properties_No_Result`. Script mở Catalog, input non-existent keyword, bấm Filter, verify empty state text và verify message "No properties match these filters."

Bên phải Job Progress hiện Passed. Console phía dưới cho thấy 12 test steps đều Passed, duration khoảng 7.728 seconds.

Ý nghĩa của bằng chứng này là SELAP không chỉ test happy path. Nhóm em cũng test cả trường hợp dữ liệu rỗng để đảm bảo hệ thống phản hồi rõ ràng, giúp customer hiểu kết quả tìm kiếm và tiếp tục điều chỉnh filter.

### Nhấn mạnh

Nói "graceful failure" hoặc "predictable empty state" nếu muốn dùng thuật ngữ kỹ thuật.

## Slide 25. Test Results And System Stability

### Lời thoại

Slide này tổng hợp kết quả test và các quality gate của hệ thống.

Theo PA3, nhóm em đã hoàn thành thiết kế 130 planned test cases. Các test case bao phủ Authentication, Admin and Region Assignment, Property Management, Favorites và Lead Management.

Trong đó, nhóm em chi tiết hóa 12 high-risk test specifications. Các kịch bản rủi ro cao gồm: đăng ký và verify email, pending agent bị chặn login, password recovery, admin approval, tạo property, favorite notification, consultation request, claim success, claim conflict và real-time lead notification.

Trong repository hiện tại, backend Jest smoke test đã pass: 1 test suite và 1 test case. Đây là mức xác nhận cơ bản rằng NestJS testing environment và app controller có thể chạy được.

Về release quality gate, nhóm em đặt mục tiêu không có defect Critical hoặc High chưa xử lý trước khi demo/release.

Về API quality gate, core response time được đặt mục tiêu dưới 500 ms trong điều kiện bình thường.

Về realtime quality gate, lead claiming và WebSocket notifications được đặt mục tiêu dưới 1 giây trong kịch bản 100 concurrent users.

Về consistency gate, concurrent lead claiming phải chỉ ghi nhận một `LeadClaim` thành công trên mỗi lead. Đây là gate quan trọng nhất vì nếu fail, sản phẩm sẽ quay lại vấn đề tranh chấp lead ban đầu.

### Nhấn mạnh

Phần này nên nói thẳng: "1 Jest smoke test là validation trong repo; Katalon evidence cho 4 UI flows; PA3 là test design coverage."

## Slide 26. Demo

### Lời thoại mở demo

Sau phần thiết kế và testing, em sẽ demo nhanh flow quan trọng nhất của SELAP: từ customer tìm bất động sản, gửi yêu cầu tư vấn, đến Sales Agent nhận lead realtime và claim lead.

### Luồng demo chính: Customer -> Lead -> Agent Claim

Bước 1, em mở trang login `/auth/login`. Ở đây SELAP yêu cầu người dùng chọn role khi đăng nhập. Điều này quan trọng vì backend sẽ validate role người dùng chọn có khớp với account thật hay không.

Bước 2, em đăng nhập với vai trò Customer. Sau khi login thành công, frontend hiện toast "Signed in successfully! Redirecting..." và redirect sang `/properties`, là property catalog.

Bước 3, ở Catalog, em demo filter bar. User có thể search theo tên property, street hoặc building, chọn Area, nhập min/max price theo đơn vị million, chọn Type như 1 Bedroom, 2 Bedrooms, Apartment, Mini Apartment, Duplex hoặc Studio, sau đó bấm Filter. Nếu có kết quả, hệ thống hiện property cards; nếu không có, hiện "No properties match these filters."

Bước 4, em mở một property detail. Trang detail hiện gallery ảnh, status, type, title, price, location, area, bedrooms, bathrooms và highlights. Với Customer, trang có hai hành động chính: "Request consultation" và "Save to Favorites".

Bước 5, em bấm "Request consultation". Frontend gọi `POST /leads` với `propertyId`. Backend tạo lead mới status `NEW`, lấy region từ property, sau đó broadcast `new_lead` đến các Sales Agent trong region đó.

Bước 6, em chuyển sang màn hình Sales Agent, route `/agent/leads`. Ở đây có tab "Real-time Inbox" và "My Assigned Leads". Nếu agent thuộc đúng region, lead mới sẽ xuất hiện trong inbox. Thông tin khách hàng ban đầu bị ẩn và UI hiện "New Consultation Request - Accept to view".

Bước 7, em bấm Accept. Backend gọi `POST /leads/{id}/claim`, kiểm tra agent active và đúng region, sau đó chạy transaction tạo `LeadClaim`. Nếu thành công, UI hiện "Lead accepted! Contact details unmasked." và agent thấy tên, số điện thoại của customer. Nếu agent khác đã claim trước, UI hiện lead đã đóng và nút Accept bị disabled.

Bước 8, em mở tab "My Assigned Leads". Lead vừa claim sẽ nằm trong danh sách của agent, có thông tin property, customer, message và dropdown status. Agent có thể cập nhật trạng thái sang Contacted, Qualified, Converted, Lost hoặc Cancelled.

### Luồng demo bổ sung nếu còn thời gian: Admin Control

Nếu còn thời gian, em sẽ demo Admin. Admin đăng nhập và vào `/admin/pending-agents`. Ở đây Admin thấy danh sách Sales Agent đang `PENDING`, chọn Area Assignment, rồi bấm Approve. Sau khi approve, account agent thành `ACTIVE` và được gán region. Đây là điều kiện để agent nhận lead đúng khu vực.

Tiếp theo, Admin có thể vào Staff Directory để xem tổng quan nhân sự: số Admin, số Sales Agents, số account Active/Pending, các vùng được gán và thống kê properties/leads. Admin cũng có thể vào Property Management để tạo, sửa, xóa property, upload images và cập nhật status.

### Câu kết demo

Qua demo này, chúng ta thấy SELAP nối liền 3 vai trò trong một workflow duy nhất: Customer tạo nhu cầu, Sales Agent xử lý lead theo thời gian thực, và Admin kiểm soát agent cùng khu vực phụ trách. Đây chính là giá trị cốt lõi của sản phẩm.

### Nhấn mạnh

Nếu demo bị lỗi dữ liệu, dùng backup story: cho xem Katalon PASS slide 18, 20, 22, 24 và giải thích các flow đã được automation verify.

## Slide 27. Closing Message

### Lời thoại

Để kết luận, SELAP không chỉ là một website xem bất động sản. SELAP là một internal operating platform cho đội sale bất động sản.

Sản phẩm kết nối property data, user roles, regional assignments, customer consultation requests và real-time lead ownership trong cùng một workflow. Customer có thể tìm và gửi nhu cầu nhanh hơn. Sales Agent nhận lead đúng khu vực và claim minh bạch hơn. Admin kiểm soát account, region, staff và property tốt hơn.

Điểm mạnh nhất của SELAP là transparent, low-latency lead claiming với database-level consistency. Nghĩa là việc ai nhận lead không còn phụ thuộc vào chat nhóm hay phân công thủ công, mà được xử lý bằng event realtime, transaction và unique constraint.

Trong tương lai, SELAP có thể mở rộng thêm analytics dashboard để theo dõi performance theo agent và khu vực, commission calculation để tính hoa hồng, cloud storage cho property images, và bộ automated regression tests đầy đủ hơn cho các workflow quan trọng.

### Nhấn mạnh

Đóng lại bằng 1 câu: "SELAP biến quy trình sale bất động sản rời rạc thành một hệ thống có dữ liệu tập trung, phân quyền rõ ràng và xử lý lead theo thời gian thực."

## Slide 28. Thank You

### Lời thoại

Phần trình bày của nhóm em đến đây là kết thúc. Cảm ơn thầy/cô và các bạn đã lắng nghe.

Nhóm em sẵn sàng nhận câu hỏi về nghiệp vụ, kiến trúc, database schema, realtime lead claiming, test automation hoặc demo flow của SELAP.

Nếu được hỏi về điểm tâm đắc nhất, em sẽ trả lời là real-time lead claiming, vì nó giải quyết trực tiếp vấn đề tranh chấp lead trong đội sale và được bảo vệ cả ở UI, backend transaction và database constraint.

### Nhấn mạnh

Kết thúc gọn, tự tin, và mời câu hỏi về phần "lead claiming" vì đây là phần có chiều sâu kỹ thuật nhất.
