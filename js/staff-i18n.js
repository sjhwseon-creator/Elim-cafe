(function initializeStaffI18n() {
  const STORAGE_KEY = "elimCafeLanguage";
  const DEFAULT_LANGUAGE = "de";
  const TAGS = { de: "de", en: "en", ko: "ko", zh: "zh-Hans" };

  const en = {
    "language.selector": "Choose language", "header.dashboard": "Tablet dashboard", "common.menu": "Menu",
    "common.refresh": "Refresh", "common.total": "Total", "common.optionalNote": "Optional note",
    "auth.access": "Staff access", "auth.title": "Sign in to the dashboard", "auth.instructions": "Enter the shared café staff email and password.",
    "auth.email": "Staff email", "auth.emailPlaceholder": "Staff email address", "auth.password": "Password", "auth.signin": "Sign in", "auth.logout": "Log out",
    "tabs.orders": "Orders", "tabs.customers": "Customers", "tabs.receipt": "Receipt Settings", "tabs.guest": "Guest Order",
    "printer.eyebrow": "Receipt printer", "printer.unavailable": "Bridge unavailable", "printer.connect": "Connect", "printer.disconnect": "Disconnect",
    "printer.test": "Test print", "printer.warning": "Automatic printing is paused. Connect the receipt printer to print pending orders.",
    "printer.state.unavailable": "Unavailable", "printer.state.disconnected": "Disconnected", "printer.state.connecting": "Connecting", "printer.state.connected": "Connected", "printer.state.printing": "Printing", "printer.state.error": "Error",
    "printer.opening": "Opening the Android printer selector...", "printer.testing": "Printing ELIM CAFE test receipt...", "printer.testSuccess": "Test receipt printed.",
    "receipt.layout": "Receipt layout", "receipt.cafeName": "Café name", "receipt.headerText": "Header text", "receipt.footerText": "Footer text",
    "receipt.additionalText": "Additional text", "receipt.additionalPlaceholder": "Optional message printed before the footer", "receipt.separator": "Separator style",
    "receipt.dashed": "Dashed", "receipt.solid": "Solid", "receipt.double": "Double", "receipt.showOn": "Show on receipt",
    "receipt.customerName": "Customer name", "receipt.orderNumber": "Order number", "receipt.payment": "Payment method", "receipt.orderTime": "Order time",
    "receipt.categorySubtotal": "Category subtotal", "receipt.textFormat": "Text format", "receipt.section": "Section", "receipt.size": "Size",
    "receipt.align": "Align", "receipt.bold": "Bold", "receipt.print": "Print", "receipt.save": "Save settings", "receipt.preview": "Preview",
    "receipt.testPreview": "Test print preview", "receipt.normal": "Normal", "receipt.large": "Large", "receipt.extraLarge": "Extra large",
    "receipt.left": "Left", "receipt.center": "Center", "receipt.right": "Right", "receipt.category": "Category",
    "receipt.orderDetails": "Order details", "receipt.items": "Drink items", "receipt.summary": "Total/payment", "receipt.footer": "Footer", "receipt.fixed": "Fixed",
    "orders.live": "Live orders", "orders.incoming": "Incoming Orders", "orders.waiting": "Waiting for orders...", "orders.none": "No orders yet.",
    "orders.order": "Order #{number}", "orders.customer": "Customer", "orders.time": "Time", "orders.payment": "Payment", "orders.reprint": "Reprint",
    "orders.archive": "Archive order", "orders.archiveLocked": "Archive after Completed + Printed", "orders.archiving": "Archiving...",
    "status.new": "New", "status.preparing": "Preparing", "status.completed": "Completed", "print.pending": "Pending print", "print.printing": "Printing in progress",
    "print.printed": "Printed {time}", "print.failed": "Print failed · {count} attempt(s)",
    "archive.previous": "Previous archive", "archive.title": "Archived Orders", "archive.empty": "No archived orders yet.", "archive.open": "Open the archive to load previous orders.",
    "archive.count": "{count} order(s) ▾", "archive.archived": "Archived {time}",
    "customers.prepaid": "Prepaid accounts", "customers.search": "Search by name or email", "customers.searchPlaceholder": "Start typing a name or email",
    "customers.filter": "Balance filter", "customers.all": "All customers", "customers.outstanding": "Outstanding balances", "customers.selected": "Selected customer",
    "customers.none": "No customers yet.", "customers.noMatch": "No matching customers.", "customers.balance": "Balance {balance}",
    "wallet.addBalance": "Add balance", "wallet.welcome": "Welcome bonus +€3", "wallet.welcomeUsed": "Welcome bonus already applied",
    "wallet.topup10": "Pay €10 → Credit €11", "wallet.topup20": "Pay €20 → Credit €22", "wallet.topup50": "Pay €50 → Credit €55",
    "wallet.customAmount": "Custom amount", "wallet.bonusRule": "10% bonus applies to top-ups of €10 or more.",
    "wallet.notePlaceholder": "Cash top-up, event credit, etc.", "wallet.refund": "Record refund", "wallet.history": "Transaction history",
    "wallet.noTransactions": "No transactions yet.", "wallet.loadingTransactions": "Loading transactions...", "wallet.balance": "Balance",
    "wallet.previewBonus": "Paid {paid} + 10% bonus {bonus} = credit {credit}", "wallet.previewNoBonus": "Paid {paid} = credit {credit}. Bonus starts at €10.",
    "transaction.topup": "Top-up", "transaction.purchase": "Purchase", "transaction.refund": "Refund", "transaction.adjustment": "Adjustment", "transaction.offering": "Offering",
    "offering.title": "Offering / Donation", "offering.help": "Deduct an offering from this customer’s existing Elim Balance. The balance cannot go below €0 for an offering.",
    "offering.amount": "Offering amount", "offering.notePlaceholder": "Sunday offering, thanksgiving offering, etc.", "offering.record": "Record offering", "offering.recording": "Recording...",
    "offering.invalid": "Enter an offering amount greater than €0 and no more than €10,000.", "offering.exceeds": "Offering cannot exceed the current balance of {balance}.",
    "offering.progress": "Recording {amount} offering for {name}...", "offering.success": "Offering {amount} recorded. New balance: {balance}.",
    "guest.eyebrow": "Staff-entered counter order", "guest.help": "Use this screen when a guest orders directly at the café without the customer app.",
    "guest.total": "Guest total", "guest.cart": "Guest Cart", "guest.name": "Name on order", "guest.place": "Place Guest Order", "guest.clear": "Clear Cart",
    "guest.empty": "Selected drinks will appear here.", "guest.items": "{count} item(s)", "payment.cash": "Cash", "payment.sepa": "SEPA bank transfer",
    "category.coffee": "Coffee", "category.latte": "Latte", "category.ade": "Ade", "variant.hot": "Hot", "variant.ice": "Ice", "cart.remove": "Remove",
    "message.loadingCustomers": "Loading customers...", "message.customerCount": "{count} customer account(s).", "message.loadingOrders": "Loading orders...",
    "message.live": "Live updates connected.", "message.loadingArchive": "Loading archived orders...", "message.archiveCount": "{count} archived order(s).",
    "message.signingIn": "Signing in...", "message.updatingOrder": "Updating order...", "message.statusUpdated": "Order status updated.",
    "message.settingsLoaded": "Receipt settings loaded.", "message.settingsSaving": "Saving receipt settings...", "message.settingsSaved": "Receipt settings saved.",
    "message.previewUpdated": "Preview updated. Save settings to use them for live orders.", "message.savingGuest": "Saving Guest order..."
  };

  const translations = {
    en,
    de: { ...en,
      "language.selector":"Sprache auswählen","header.dashboard":"Tablet-Dashboard","common.menu":"Menü","common.refresh":"Aktualisieren","common.total":"Gesamt","common.optionalNote":"Optionale Notiz",
      "auth.access":"Mitarbeiterzugang","auth.title":"Beim Dashboard anmelden","auth.instructions":"Gib die gemeinsame Mitarbeiter-E-Mail und das Passwort ein.","auth.email":"Mitarbeiter-E-Mail","auth.emailPlaceholder":"E-Mail-Adresse","auth.password":"Passwort","auth.signin":"Anmelden","auth.logout":"Abmelden",
      "tabs.orders":"Bestellungen","tabs.customers":"Kunden","tabs.receipt":"Bon-Einstellungen","tabs.guest":"Gastbestellung",
      "printer.eyebrow":"Bondrucker","printer.unavailable":"Bridge nicht verfügbar","printer.connect":"Verbinden","printer.disconnect":"Trennen","printer.test":"Testdruck","printer.warning":"Der automatische Druck ist pausiert. Verbinde den Bondrucker, um ausstehende Bestellungen zu drucken.","printer.state.unavailable":"Nicht verfügbar","printer.state.disconnected":"Getrennt","printer.state.connecting":"Verbindung wird hergestellt","printer.state.connected":"Verbunden","printer.state.printing":"Druckt","printer.state.error":"Fehler","printer.opening":"Android-Druckerauswahl wird geöffnet...","printer.testing":"ELIM CAFE Testbon wird gedruckt...","printer.testSuccess":"Testbon gedruckt.",
      "receipt.layout":"Bon-Layout","receipt.cafeName":"Café-Name","receipt.headerText":"Kopfzeile","receipt.footerText":"Fußzeile","receipt.additionalText":"Zusatztext","receipt.additionalPlaceholder":"Optionale Nachricht vor der Fußzeile","receipt.separator":"Trennlinie","receipt.dashed":"Gestrichelt","receipt.solid":"Durchgezogen","receipt.double":"Doppelt","receipt.showOn":"Auf dem Bon anzeigen","receipt.customerName":"Kundenname","receipt.orderNumber":"Bestellnummer","receipt.payment":"Zahlungsart","receipt.orderTime":"Bestellzeit","receipt.categorySubtotal":"Kategorie-Zwischensumme","receipt.textFormat":"Textformat","receipt.section":"Bereich","receipt.size":"Größe","receipt.align":"Ausrichtung","receipt.bold":"Fett","receipt.print":"Drucken","receipt.save":"Einstellungen speichern","receipt.preview":"Vorschau","receipt.testPreview":"Vorschau testdrucken","receipt.normal":"Normal","receipt.large":"Groß","receipt.extraLarge":"Sehr groß","receipt.left":"Links","receipt.center":"Mitte","receipt.right":"Rechts","receipt.category":"Kategorie","receipt.orderDetails":"Bestelldetails","receipt.items":"Getränke","receipt.summary":"Gesamt/Zahlung","receipt.footer":"Fußzeile","receipt.fixed":"Fest",
      "orders.live":"Live-Bestellungen","orders.incoming":"Eingehende Bestellungen","orders.waiting":"Warte auf Bestellungen...","orders.none":"Noch keine Bestellungen.","orders.order":"Bestellung #{number}","orders.customer":"Kunde","orders.time":"Zeit","orders.payment":"Zahlung","orders.reprint":"Erneut drucken","orders.archive":"Archivieren","orders.archiveLocked":"Nach Abschluss + Druck archivieren","orders.archiving":"Wird archiviert...","status.new":"Neu","status.preparing":"In Zubereitung","status.completed":"Abgeschlossen","print.pending":"Druck ausstehend","print.printing":"Druck läuft","print.printed":"Gedruckt {time}","print.failed":"Druck fehlgeschlagen · {count} Versuch(e)",
      "archive.previous":"Früheres Archiv","archive.title":"Archivierte Bestellungen","archive.empty":"Noch keine archivierten Bestellungen.","archive.open":"Öffne das Archiv, um frühere Bestellungen zu laden.","archive.count":"{count} Bestellung(en) ▾","archive.archived":"Archiviert {time}",
      "customers.prepaid":"Guthabenkonten","customers.search":"Nach Name oder E-Mail suchen","customers.searchPlaceholder":"Name oder E-Mail eingeben","customers.filter":"Guthabenfilter","customers.all":"Alle Kunden","customers.outstanding":"Offene Guthaben","customers.selected":"Ausgewählter Kunde","customers.none":"Noch keine Kunden.","customers.noMatch":"Keine passenden Kunden.","customers.balance":"Guthaben {balance}",
      "wallet.addBalance":"Guthaben aufladen","wallet.welcome":"Willkommensrabatt +€3","wallet.welcomeUsed":"Willkommensrabatt bereits vergeben","wallet.customAmount":"Eigener Betrag","wallet.bonusRule":"Ab €10 Aufladung gibt es 10 % Bonus.","wallet.notePlaceholder":"Baraufladung, Veranstaltungsguthaben usw.","wallet.refund":"Erstattung buchen","wallet.history":"Transaktionsverlauf","wallet.noTransactions":"Noch keine Transaktionen.","wallet.loadingTransactions":"Transaktionen werden geladen...","wallet.balance":"Guthaben","wallet.previewBonus":"Bezahlt {paid} + 10 % Bonus {bonus} = Gutschrift {credit}","wallet.previewNoBonus":"Bezahlt {paid} = Gutschrift {credit}. Bonus ab €10.","transaction.topup":"Aufladung","transaction.purchase":"Kauf","transaction.refund":"Erstattung","transaction.adjustment":"Anpassung","transaction.offering":"Spende",
      "offering.title":"Spende / Kollekte","offering.help":"Die Spende wird vom vorhandenen Elim-Guthaben abgezogen. Das Guthaben kann dadurch nicht unter €0 fallen.","offering.amount":"Spendenbetrag","offering.notePlaceholder":"Sonntagskollekte, Dankopfer usw.","offering.record":"Spende buchen","offering.recording":"Wird gebucht...","offering.invalid":"Gib einen Spendenbetrag über €0 und höchstens €10.000 ein.","offering.exceeds":"Die Spende darf das aktuelle Guthaben von {balance} nicht überschreiten.","offering.progress":"Spende von {amount} für {name} wird gebucht...","offering.success":"Spende von {amount} gebucht. Neues Guthaben: {balance}.",
      "guest.eyebrow":"Vom Personal erfasste Bestellung","guest.help":"Für Gäste, die direkt im Café ohne Kunden-App bestellen.","guest.total":"Gast-Gesamtsumme","guest.cart":"Gast-Warenkorb","guest.name":"Name der Bestellung","guest.place":"Gastbestellung aufgeben","guest.clear":"Warenkorb leeren","guest.empty":"Ausgewählte Getränke erscheinen hier.","guest.items":"{count} Artikel","payment.cash":"Bar","payment.sepa":"SEPA-Überweisung","category.coffee":"Kaffee","category.latte":"Latte","category.ade":"Erfrischungen","variant.hot":"Heiß","variant.ice":"Kalt","cart.remove":"Entfernen",
      "message.loadingCustomers":"Kunden werden geladen...","message.customerCount":"{count} Kundenkonto/-konten.","message.loadingOrders":"Bestellungen werden geladen...","message.live":"Live-Aktualisierung verbunden.","message.loadingArchive":"Archiv wird geladen...","message.archiveCount":"{count} archivierte Bestellung(en).","message.signingIn":"Anmeldung läuft...","message.updatingOrder":"Bestellung wird aktualisiert...","message.statusUpdated":"Bestellstatus aktualisiert.","message.settingsLoaded":"Bon-Einstellungen geladen.","message.settingsSaving":"Bon-Einstellungen werden gespeichert...","message.settingsSaved":"Bon-Einstellungen gespeichert.","message.previewUpdated":"Vorschau aktualisiert. Speichere die Einstellungen für Live-Bestellungen.","message.savingGuest":"Gastbestellung wird gespeichert..."
    },
    ko: { ...en,
      "language.selector":"언어 선택","header.dashboard":"태블릿 대시보드","common.menu":"메뉴","common.refresh":"새로고침","common.total":"합계","common.optionalNote":"선택 메모",
      "auth.access":"직원 전용","auth.title":"직원 대시보드 로그인","auth.instructions":"공용 직원 이메일과 비밀번호를 입력하세요.","auth.email":"직원 이메일","auth.emailPlaceholder":"직원 이메일 주소","auth.password":"비밀번호","auth.signin":"로그인","auth.logout":"로그아웃",
      "tabs.orders":"주문","tabs.customers":"고객","tabs.receipt":"영수증 설정","tabs.guest":"현장 주문",
      "printer.eyebrow":"영수증 프린터","printer.unavailable":"브리지를 사용할 수 없음","printer.connect":"연결","printer.disconnect":"연결 해제","printer.test":"테스트 출력","printer.warning":"자동 출력이 일시 중지되었습니다. 대기 주문을 출력하려면 프린터를 연결하세요.","printer.state.unavailable":"사용 불가","printer.state.disconnected":"연결 안 됨","printer.state.connecting":"연결 중","printer.state.connected":"연결됨","printer.state.printing":"출력 중","printer.state.error":"오류","printer.opening":"Android 프린터 선택 화면을 여는 중...","printer.testing":"ELIM CAFE 테스트 영수증 출력 중...","printer.testSuccess":"테스트 영수증이 출력되었습니다.",
      "receipt.layout":"영수증 구성","receipt.cafeName":"카페 이름","receipt.headerText":"머리글","receipt.footerText":"바닥글","receipt.additionalText":"추가 문구","receipt.additionalPlaceholder":"바닥글 앞에 출력할 선택 문구","receipt.separator":"구분선 모양","receipt.dashed":"점선","receipt.solid":"실선","receipt.double":"이중선","receipt.showOn":"영수증 표시 항목","receipt.customerName":"고객 이름","receipt.orderNumber":"주문번호","receipt.payment":"결제 방법","receipt.orderTime":"주문 시간","receipt.categorySubtotal":"카테고리 소계","receipt.textFormat":"글자 형식","receipt.section":"구역","receipt.size":"크기","receipt.align":"정렬","receipt.bold":"굵게","receipt.print":"출력","receipt.save":"설정 저장","receipt.preview":"미리보기","receipt.testPreview":"미리보기 테스트 출력","receipt.normal":"보통","receipt.large":"크게","receipt.extraLarge":"매우 크게","receipt.left":"왼쪽","receipt.center":"가운데","receipt.right":"오른쪽","receipt.category":"카테고리","receipt.orderDetails":"주문 정보","receipt.items":"음료 항목","receipt.summary":"합계/결제","receipt.footer":"바닥글","receipt.fixed":"고정",
      "orders.live":"실시간 주문","orders.incoming":"접수 주문","orders.waiting":"주문을 기다리는 중...","orders.none":"접수된 주문이 없습니다.","orders.order":"주문 #{number}","orders.customer":"고객","orders.time":"시간","orders.payment":"결제","orders.reprint":"재출력","orders.archive":"보관함으로 이동","orders.archiveLocked":"완료 및 출력 후 보관 가능","orders.archiving":"보관 중...","status.new":"신규","status.preparing":"준비 중","status.completed":"완료","print.pending":"출력 대기","print.printing":"출력 중","print.printed":"{time} 출력 완료","print.failed":"출력 실패 · {count}회 시도",
      "archive.previous":"이전 보관함","archive.title":"보관된 주문","archive.empty":"보관된 주문이 없습니다.","archive.open":"보관함을 열어 이전 주문을 확인하세요.","archive.count":"{count}개 주문 ▾","archive.archived":"{time} 보관됨",
      "customers.prepaid":"선불 계정","customers.search":"이름 또는 이메일 검색","customers.searchPlaceholder":"이름이나 이메일을 입력하세요","customers.filter":"잔액 필터","customers.all":"모든 고객","customers.outstanding":"미납 잔액","customers.selected":"선택한 고객","customers.none":"등록된 고객이 없습니다.","customers.noMatch":"일치하는 고객이 없습니다.","customers.balance":"잔액 {balance}",
      "wallet.addBalance":"잔액 충전","wallet.welcome":"환영 할인 +€3","wallet.welcomeUsed":"환영 할인 적용 완료","wallet.customAmount":"직접 입력","wallet.bonusRule":"€10 이상 충전 시 10% 보너스가 적용됩니다.","wallet.notePlaceholder":"현금 충전, 행사 크레딧 등","wallet.refund":"환불 기록","wallet.history":"거래 내역","wallet.noTransactions":"거래 내역이 없습니다.","wallet.loadingTransactions":"거래 내역 불러오는 중...","wallet.balance":"잔액","wallet.previewBonus":"결제 {paid} + 10% 보너스 {bonus} = {credit} 충전","wallet.previewNoBonus":"결제 {paid} = {credit} 충전. 보너스는 €10부터 적용됩니다.","transaction.topup":"충전","transaction.purchase":"구매","transaction.refund":"환불","transaction.adjustment":"조정","transaction.offering":"헌금",
      "offering.title":"헌금","offering.help":"고객의 기존 Elim 잔액에서 헌금액을 차감합니다. 헌금으로 잔액이 €0 미만이 되지는 않습니다.","offering.amount":"헌금 금액","offering.notePlaceholder":"주일헌금, 감사헌금 등","offering.record":"헌금 기록","offering.recording":"기록 중...","offering.invalid":"€0보다 크고 €10,000 이하인 헌금액을 입력하세요.","offering.exceeds":"헌금액은 현재 잔액 {balance}을 초과할 수 없습니다.","offering.progress":"{name}님의 헌금 {amount}을 기록하는 중...","offering.success":"헌금 {amount}이 기록되었습니다. 새 잔액: {balance}.",
      "guest.eyebrow":"직원 입력 현장 주문","guest.help":"고객 앱 없이 카페에서 바로 주문하는 손님을 위한 화면입니다.","guest.total":"Guest 누적 금액","guest.cart":"현장 주문 장바구니","guest.name":"주문자 이름","guest.place":"현장 주문 접수","guest.clear":"장바구니 비우기","guest.empty":"선택한 음료가 여기에 표시됩니다.","guest.items":"{count}개","payment.cash":"현금","payment.sepa":"SEPA 계좌이체","category.coffee":"커피","category.latte":"라떼","category.ade":"에이드","variant.hot":"따뜻한","variant.ice":"아이스","cart.remove":"삭제",
      "message.loadingCustomers":"고객을 불러오는 중...","message.customerCount":"고객 계정 {count}개.","message.loadingOrders":"주문을 불러오는 중...","message.live":"실시간 업데이트 연결됨.","message.loadingArchive":"보관함을 불러오는 중...","message.archiveCount":"보관된 주문 {count}개.","message.signingIn":"로그인 중...","message.updatingOrder":"주문을 업데이트하는 중...","message.statusUpdated":"주문 상태가 변경되었습니다.","message.settingsLoaded":"영수증 설정을 불러왔습니다.","message.settingsSaving":"영수증 설정 저장 중...","message.settingsSaved":"영수증 설정이 저장되었습니다.","message.previewUpdated":"미리보기가 업데이트되었습니다. 실제 주문에 사용하려면 저장하세요.","message.savingGuest":"현장 주문 저장 중..."
    },
    zh: { ...en,
      "language.selector":"选择语言","header.dashboard":"平板工作台","common.menu":"菜单","common.refresh":"刷新","common.total":"合计","common.optionalNote":"备注（可选）",
      "auth.access":"员工入口","auth.title":"登录员工工作台","auth.instructions":"请输入咖啡厅共用的员工邮箱和密码。","auth.email":"员工邮箱","auth.emailPlaceholder":"员工邮箱地址","auth.password":"密码","auth.signin":"登录","auth.logout":"退出登录",
      "tabs.orders":"订单","tabs.customers":"顾客","tabs.receipt":"小票设置","tabs.guest":"现场订单",
      "printer.eyebrow":"小票打印机","printer.unavailable":"打印桥不可用","printer.connect":"连接","printer.disconnect":"断开连接","printer.test":"测试打印","printer.warning":"自动打印已暂停。请连接小票打印机以打印待处理订单。","printer.state.unavailable":"不可用","printer.state.disconnected":"未连接","printer.state.connecting":"正在连接","printer.state.connected":"已连接","printer.state.printing":"正在打印","printer.state.error":"错误","printer.opening":"正在打开 Android 打印机选择器...","printer.testing":"正在打印 ELIM CAFE 测试小票...","printer.testSuccess":"测试小票已打印。",
      "receipt.layout":"小票布局","receipt.cafeName":"咖啡厅名称","receipt.headerText":"页眉文字","receipt.footerText":"页脚文字","receipt.additionalText":"附加文字","receipt.additionalPlaceholder":"在页脚前打印的可选信息","receipt.separator":"分隔线样式","receipt.dashed":"虚线","receipt.solid":"实线","receipt.double":"双线","receipt.showOn":"小票显示内容","receipt.customerName":"顾客姓名","receipt.orderNumber":"订单号","receipt.payment":"付款方式","receipt.orderTime":"下单时间","receipt.categorySubtotal":"分类小计","receipt.textFormat":"文字格式","receipt.section":"区域","receipt.size":"大小","receipt.align":"对齐","receipt.bold":"粗体","receipt.print":"打印","receipt.save":"保存设置","receipt.preview":"预览","receipt.testPreview":"测试打印预览","receipt.normal":"普通","receipt.large":"大","receipt.extraLarge":"特大","receipt.left":"左对齐","receipt.center":"居中","receipt.right":"右对齐","receipt.category":"分类","receipt.orderDetails":"订单信息","receipt.items":"饮品项目","receipt.summary":"合计/付款","receipt.footer":"页脚","receipt.fixed":"固定",
      "orders.live":"实时订单","orders.incoming":"新订单","orders.waiting":"正在等待订单...","orders.none":"暂无订单。","orders.order":"订单 #{number}","orders.customer":"顾客","orders.time":"时间","orders.payment":"付款","orders.reprint":"重新打印","orders.archive":"移入存档","orders.archiveLocked":"完成并打印后可存档","orders.archiving":"正在存档...","status.new":"新订单","status.preparing":"制作中","status.completed":"已完成","print.pending":"等待打印","print.printing":"正在打印","print.printed":"已打印 {time}","print.failed":"打印失败 · 已尝试 {count} 次",
      "archive.previous":"历史存档","archive.title":"已存档订单","archive.empty":"暂无已存档订单。","archive.open":"打开存档以查看历史订单。","archive.count":"{count} 个订单 ▾","archive.archived":"存档于 {time}",
      "customers.prepaid":"预付账户","customers.search":"按姓名或邮箱搜索","customers.searchPlaceholder":"输入姓名或邮箱","customers.filter":"余额筛选","customers.all":"所有顾客","customers.outstanding":"欠款余额","customers.selected":"已选顾客","customers.none":"暂无顾客。","customers.noMatch":"没有匹配的顾客。","customers.balance":"余额 {balance}",
      "wallet.addBalance":"充值","wallet.welcome":"欢迎优惠 +€3","wallet.welcomeUsed":"欢迎优惠已发放","wallet.customAmount":"自定义金额","wallet.bonusRule":"充值 €10 或以上可获 10% 奖励。","wallet.notePlaceholder":"现金充值、活动额度等","wallet.refund":"记录退款","wallet.history":"交易记录","wallet.noTransactions":"暂无交易记录。","wallet.loadingTransactions":"正在加载交易记录...","wallet.balance":"余额","wallet.previewBonus":"支付 {paid} + 10% 奖励 {bonus} = 到账 {credit}","wallet.previewNoBonus":"支付 {paid} = 到账 {credit}。奖励从 €10 起。","transaction.topup":"充值","transaction.purchase":"购买","transaction.refund":"退款","transaction.adjustment":"调整","transaction.offering":"奉献",
      "offering.title":"奉献","offering.help":"从顾客现有的 Elim 余额中扣除奉献金额。奉献不会使余额低于 €0。","offering.amount":"奉献金额","offering.notePlaceholder":"主日奉献、感恩奉献等","offering.record":"记录奉献","offering.recording":"正在记录...","offering.invalid":"请输入大于 €0 且不超过 €10,000 的奉献金额。","offering.exceeds":"奉献金额不能超过当前余额 {balance}。","offering.progress":"正在为 {name} 记录 {amount} 奉献...","offering.success":"已记录 {amount} 奉献。新余额：{balance}。",
      "guest.eyebrow":"员工录入现场订单","guest.help":"用于未使用顾客应用、直接在咖啡厅点单的客人。","guest.total":"Guest 累计金额","guest.cart":"现场订单购物车","guest.name":"订单姓名","guest.place":"提交现场订单","guest.clear":"清空购物车","guest.empty":"所选饮品将显示在这里。","guest.items":"{count} 件","payment.cash":"现金","payment.sepa":"SEPA 银行转账","category.coffee":"咖啡","category.latte":"拿铁","category.ade":"水果气泡饮","variant.hot":"热","variant.ice":"冰","cart.remove":"删除",
      "message.loadingCustomers":"正在加载顾客...","message.customerCount":"{count} 个顾客账户。","message.loadingOrders":"正在加载订单...","message.live":"实时更新已连接。","message.loadingArchive":"正在加载存档...","message.archiveCount":"{count} 个已存档订单。","message.signingIn":"正在登录...","message.updatingOrder":"正在更新订单...","message.statusUpdated":"订单状态已更新。","message.settingsLoaded":"小票设置已加载。","message.settingsSaving":"正在保存小票设置...","message.settingsSaved":"小票设置已保存。","message.previewUpdated":"预览已更新。请保存设置以用于实时订单。","message.savingGuest":"正在保存现场订单..."
    }
  };

  let language;
  try { language = localStorage.getItem(STORAGE_KEY); } catch (_) { language = null; }
  if (!translations[language]) language = DEFAULT_LANGUAGE;

  function t(key, variables = {}) {
    const template = translations[language]?.[key] ?? en[key] ?? key;
    return Object.entries(variables).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
  }

  function apply(root = document) {
    document.documentElement.lang = TAGS[language];
    root.querySelectorAll("[data-staff-i18n]").forEach((element) => { element.textContent = t(element.dataset.staffI18n); });
    root.querySelectorAll("[data-staff-i18n-placeholder]").forEach((element) => element.setAttribute("placeholder", t(element.dataset.staffI18nPlaceholder)));
    root.querySelectorAll("[data-staff-i18n-aria-label]").forEach((element) => element.setAttribute("aria-label", t(element.dataset.staffI18nAriaLabel)));
    root.querySelectorAll("[data-staff-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.staffLanguage === language)));

    const optionKeys = { "1": "receipt.normal", "2": "receipt.large", "3": "receipt.extraLarge", left: "receipt.left", center: "receipt.center", right: "receipt.right" };
    root.querySelectorAll(".receipt-format-editor option").forEach((option) => { if (optionKeys[option.value]) option.textContent = t(optionKeys[option.value]); });
    const rowKeys = ["receipt.cafeName", "receipt.headerText", "receipt.category", "receipt.orderDetails", "receipt.items", "receipt.summary", "receipt.additionalText", "receipt.footer"];
    root.querySelectorAll(".receipt-format-row").forEach((row, index) => { const title = row.querySelector("strong"); if (title && rowKeys[index]) title.textContent = t(rowKeys[index]); });
    root.querySelectorAll(".receipt-format-row .compact-check").forEach((label) => { const input = label.querySelector("input"); if (input) label.lastChild.textContent = ` ${t(input.id.includes("bold") ? "receipt.bold" : "receipt.print")}`; });
  }

  function setLanguage(nextLanguage) {
    if (!translations[nextLanguage]) return;
    language = nextLanguage;
    try { localStorage.setItem(STORAGE_KEY, language); } catch (_) {}
    apply();
    document.dispatchEvent(new CustomEvent("elim:staff-languagechange", { detail: { language } }));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-staff-language]");
    if (button) setLanguage(button.dataset.staffLanguage);
  });

  window.ELIM_STAFF_I18N = { t, apply, setLanguage, getLanguage: () => language };
  apply();
})();
