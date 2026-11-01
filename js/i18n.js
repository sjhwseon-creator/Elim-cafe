(function initializeI18n() {
  const STORAGE_KEY = "elimCafeLanguage";
  const DEFAULT_LANGUAGE = "de";
  const LANGUAGE_TAGS = {
    de: "de",
    en: "en",
    ko: "ko",
    zh: "zh-Hans"
  };

  const translations = {
    de: {
      "header.welcome": "Willkommen im",
      "header.tagline": "Guter Kaffee · Hellere Tage",
      "header.note": "Ein bisschen Freude\nin jeder Tasse",
      "language.selector": "Sprache auswählen",
      "menu.eyebrow": "Heutige Auswahl",
      "menu.intro": "Wähle deine Getränke und mach deinen Tag ein bisschen schöner!",
      "category.coffee": "Kaffee",
      "category.latte": "Latte",
      "category.ade": "Erfrischungen",
      "category.coffeeDescription": "Voller Geschmack, ein schönerer Tag",
      "category.latteDescription": "Cremig, mild und immer eine gute Idee",
      "category.adeDescription": "Fruchtige Erfrischung für helle Tage",
      "category.defaultDescription": "Mit Sorgfalt zubereitet",
      "variant.hot": "Heiß",
      "variant.ice": "Kalt",
      "cart.eyebrow": "Deine Bestellung",
      "cart.title": "Warenkorb",
      "cart.itemCountOne": "{count} Artikel",
      "cart.itemCountMany": "{count} Artikel",
      "cart.empty": "Deine ausgewählten Getränke erscheinen hier.",
      "cart.total": "Gesamt",
      "cart.remove": "Entfernen",
      "customer.name": "Dein Name",
      "customer.namePlaceholder": "Name eingeben",
      "auth.account": "Konto",
      "auth.title": "Kundenkonto",
      "auth.signIn": "Anmelden",
      "auth.signUp": "Registrieren",
      "auth.signOut": "Abmelden",
      "auth.createAccount": "Konto erstellen",
      "auth.name": "Name",
      "auth.email": "E-Mail",
      "auth.password": "Passwort",
      "auth.confirmPassword": "Passwort bestätigen",
      "auth.namePlaceholder": "Dein Name",
      "auth.emailPlaceholder": "E-Mail-Adresse",
      "auth.passwordPlaceholder": "Mindestens 6 Zeichen",
      "auth.confirmPasswordPlaceholder": "Passwort wiederholen",
      "auth.checking": "Konto wird geprüft...",
      "auth.balance": "Elim-Guthaben",
      "auth.hello": "Hallo, {name}",
      "auth.mode": "Kontoaktion",
      "auth.close": "Schließen",
      "auth.signingIn": "Anmeldung läuft...",
      "auth.creating": "Konto wird erstellt...",
      "auth.checkEmail": "Konto erstellt. Bitte bestätige deine E-Mail über den Link in deinem Postfach.",
      "auth.signInFailed": "Anmeldung fehlgeschlagen. Bitte prüfe E-Mail und Passwort.",
      "auth.signUpFailed": "Konto konnte nicht erstellt werden. Bitte prüfe deine Angaben.",
      "auth.profileFailed": "Kontodaten konnten nicht geladen werden. Bitte versuche es erneut.",
      "auth.callbackFailed": "Die E-Mail-Bestätigung konnte nicht abgeschlossen werden.",
      "auth.passwordMismatch": "Die Passwörter stimmen nicht überein.",
      "auth.inactive": "Dieses Kundenkonto ist nicht aktiv. Bitte wende dich an das Café-Team.",
      "auth.sessionFailed": "Die gespeicherte Anmeldung konnte nicht wiederhergestellt werden. Bitte melde dich erneut an.",
      "notification.enable": "Bestellbenachrichtigungen aktivieren",
      "notification.disable": "Benachrichtigungen deaktivieren",
      "notification.enabling": "Benachrichtigungen werden aktiviert...",
      "notification.enabled": "Bestellbenachrichtigungen sind aktiviert.",
      "notification.disabled": "Bestellbenachrichtigungen sind deaktiviert.",
      "notification.unsupported": "Dieses Gerät unterstützt keine Web-Push-Benachrichtigungen.",
      "notification.denied": "Benachrichtigungen wurden nicht erlaubt. Bestellungen funktionieren weiterhin normal.",
      "notification.error": "Benachrichtigungen konnten nicht eingerichtet werden.",
      "ready.title": "Deine Bestellung ist fertig!",
      "ready.body": "Bitte hole deine Getränke am Café ab.",
      "ready.order": "Bestellung #{number}",
      "ready.close": "Schließen",
      "wallet.currentBalance": "Aktuelles Guthaben",
      "wallet.orderTotal": "Bestellwert",
      "wallet.balanceAfter": "Guthaben danach",
      "order.review": "Bestellung prüfen",
      "order.place": "Bestellung aufgeben",
      "order.clear": "Warenkorb leeren",
      "order.confirmFor": "Bestellung für {name} bestätigen",
      "order.sending": "Deine Bestellung wird gesendet...",
      "order.number": "Bestellung #{number}",
      "order.total": "Gesamt: {total}",
      "confirmation.thankYou": "Vielen Dank",
      "confirmation.received": "Bestellung erhalten!",
      "confirmation.wait": "Bitte warte auf deine Bestellung.",
      "confirmation.newOrder": "Neue Bestellung starten",
      "confirmation.balance": "Elim-Guthaben: {balance}",
      "validation.addItem": "Bitte füge mindestens einen Artikel hinzu.",
      "validation.enterName": "Bitte gib vor der Bestellung deinen Namen ein.",
      "error.serviceUnavailable": "Bestellungen sind momentan nicht verfügbar. Bitte wende dich an das Café-Team.",
      "error.orderFailed": "Die Bestellung konnte nicht gespeichert werden. Bitte versuche es erneut.",
      "aria.quantity": "Menge für {item}",
      "aria.cartQuantity": "Menge im Warenkorb für {item}",
      "aria.addOne": "Einmal {item} hinzufügen",
      "aria.removeOne": "Einmal {item} entfernen"
    },
    en: {
      "header.welcome": "Welcome to",
      "header.tagline": "Good Coffee · Brighter Days",
      "header.note": "A little goodness\nin every cup",
      "language.selector": "Choose language",
      "menu.eyebrow": "Today's menu",
      "menu.intro": "Choose your drinks and make your day brighter!",
      "category.coffee": "Coffee",
      "category.latte": "Latte",
      "category.ade": "Ade",
      "category.coffeeDescription": "Rich flavors, a better day",
      "category.latteDescription": "Soft, creamy, always a good idea",
      "category.adeDescription": "Fruity refreshment for brighter days",
      "category.defaultDescription": "Made with care",
      "variant.hot": "Hot",
      "variant.ice": "Ice",
      "cart.eyebrow": "Your order",
      "cart.title": "Cart",
      "cart.itemCountOne": "{count} item",
      "cart.itemCountMany": "{count} items",
      "cart.empty": "Your selected drinks will appear here.",
      "cart.total": "Total",
      "cart.remove": "Remove",
      "customer.name": "Your name",
      "customer.namePlaceholder": "Enter your name",
      "auth.account": "Account",
      "auth.title": "Customer account",
      "auth.signIn": "Sign in",
      "auth.signUp": "Sign up",
      "auth.signOut": "Sign out",
      "auth.createAccount": "Create account",
      "auth.name": "Name",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.confirmPassword": "Confirm password",
      "auth.namePlaceholder": "Your name",
      "auth.emailPlaceholder": "Email address",
      "auth.passwordPlaceholder": "At least 6 characters",
      "auth.confirmPasswordPlaceholder": "Enter the password again",
      "auth.checking": "Checking your account...",
      "auth.balance": "Elim Balance",
      "auth.hello": "Hello, {name}",
      "auth.mode": "Account action",
      "auth.close": "Close",
      "auth.signingIn": "Signing in...",
      "auth.creating": "Creating your account...",
      "auth.checkEmail": "Account created. Please confirm your email using the link in your inbox.",
      "auth.signInFailed": "Could not sign in. Please check your email and password.",
      "auth.signUpFailed": "Could not create the account. Please check your details.",
      "auth.profileFailed": "Could not load your account details. Please try again.",
      "auth.callbackFailed": "Could not complete the email confirmation.",
      "auth.passwordMismatch": "The passwords do not match.",
      "auth.inactive": "This customer account is not active. Please contact the café team.",
      "auth.sessionFailed": "Could not restore your saved session. Please sign in again.",
      "notification.enable": "Enable order notifications",
      "notification.disable": "Disable notifications",
      "notification.enabling": "Enabling notifications...",
      "notification.enabled": "Order notifications are enabled.",
      "notification.disabled": "Order notifications are disabled.",
      "notification.unsupported": "This device does not support Web Push notifications.",
      "notification.denied": "Notifications were not allowed. Ordering will continue to work normally.",
      "notification.error": "Could not set up notifications.",
      "ready.title": "Your order is ready!",
      "ready.body": "Please pick it up at the café counter.",
      "ready.order": "Order #{number}",
      "ready.close": "Close",
      "wallet.currentBalance": "Current balance",
      "wallet.orderTotal": "Order total",
      "wallet.balanceAfter": "Balance after order",
      "order.review": "Review Order",
      "order.place": "Place Order",
      "order.clear": "Clear Cart",
      "order.confirmFor": "Confirm order for {name}",
      "order.sending": "Sending your order...",
      "order.number": "Order #{number}",
      "order.total": "Total: {total}",
      "confirmation.thankYou": "Thank you",
      "confirmation.received": "Order received!",
      "confirmation.wait": "Please wait for your order.",
      "confirmation.newOrder": "Start another order",
      "confirmation.balance": "Elim Balance: {balance}",
      "validation.addItem": "Please add at least one item.",
      "validation.enterName": "Please enter your name before ordering.",
      "error.serviceUnavailable": "Ordering is currently unavailable. Please ask the café team for help.",
      "error.orderFailed": "Could not save your order. Please try again.",
      "aria.quantity": "{item} quantity",
      "aria.cartQuantity": "{item} cart quantity",
      "aria.addOne": "Add one {item}",
      "aria.removeOne": "Remove one {item}"
    },
    ko: {
      "header.welcome": "환영합니다",
      "header.tagline": "좋은 커피 · 더 밝은 하루",
      "header.note": "한 잔마다 담긴\n작은 행복",
      "language.selector": "언어 선택",
      "menu.eyebrow": "오늘의 메뉴",
      "menu.intro": "음료를 골라 더 밝은 하루를 만들어 보세요!",
      "category.coffee": "커피",
      "category.latte": "라떼",
      "category.ade": "에이드",
      "category.coffeeDescription": "진한 풍미로 더 좋은 하루",
      "category.latteDescription": "부드럽고 고소한 좋은 선택",
      "category.adeDescription": "상큼하게 채우는 밝은 하루",
      "category.defaultDescription": "정성을 담아 준비했습니다",
      "variant.hot": "따뜻한",
      "variant.ice": "아이스",
      "cart.eyebrow": "주문 내역",
      "cart.title": "장바구니",
      "cart.itemCountOne": "{count}개",
      "cart.itemCountMany": "{count}개",
      "cart.empty": "선택한 음료가 여기에 표시됩니다.",
      "cart.total": "합계",
      "cart.remove": "삭제",
      "customer.name": "이름",
      "customer.namePlaceholder": "이름을 입력하세요",
      "auth.account": "계정",
      "auth.title": "고객 계정",
      "auth.signIn": "로그인",
      "auth.signUp": "회원가입",
      "auth.signOut": "로그아웃",
      "auth.createAccount": "계정 만들기",
      "auth.name": "이름",
      "auth.email": "이메일",
      "auth.password": "비밀번호",
      "auth.confirmPassword": "비밀번호 확인",
      "auth.namePlaceholder": "이름",
      "auth.emailPlaceholder": "이메일 주소",
      "auth.passwordPlaceholder": "6자 이상",
      "auth.confirmPasswordPlaceholder": "비밀번호를 다시 입력하세요",
      "auth.checking": "계정을 확인하고 있습니다...",
      "auth.balance": "Elim 잔액",
      "auth.hello": "안녕하세요, {name}님",
      "auth.mode": "계정 작업",
      "auth.close": "닫기",
      "auth.signingIn": "로그인 중입니다...",
      "auth.creating": "계정을 만들고 있습니다...",
      "auth.checkEmail": "계정이 생성되었습니다. 받은 편지함의 링크로 이메일을 확인해 주세요.",
      "auth.signInFailed": "로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.",
      "auth.signUpFailed": "계정을 만들지 못했습니다. 입력 내용을 확인해 주세요.",
      "auth.profileFailed": "계정 정보를 불러오지 못했습니다. 다시 시도해 주세요.",
      "auth.callbackFailed": "이메일 확인을 완료하지 못했습니다.",
      "auth.passwordMismatch": "비밀번호가 서로 일치하지 않습니다.",
      "auth.inactive": "이 고객 계정은 비활성 상태입니다. 카페 담당자에게 문의해 주세요.",
      "auth.sessionFailed": "저장된 로그인 세션을 복원하지 못했습니다. 다시 로그인해 주세요.",
      "notification.enable": "주문 완료 알림 켜기",
      "notification.disable": "알림 끄기",
      "notification.enabling": "알림을 설정하고 있습니다...",
      "notification.enabled": "주문 완료 알림이 켜졌습니다.",
      "notification.disabled": "주문 완료 알림이 꺼졌습니다.",
      "notification.unsupported": "이 기기는 웹 푸시 알림을 지원하지 않습니다.",
      "notification.denied": "알림이 허용되지 않았습니다. 주문은 계속 정상적으로 이용할 수 있습니다.",
      "notification.error": "알림을 설정하지 못했습니다.",
      "ready.title": "주문하신 음료가 준비되었습니다!",
      "ready.body": "카페 카운터에서 픽업해주세요.",
      "ready.order": "주문 #{number}",
      "ready.close": "닫기",
      "wallet.currentBalance": "현재 잔액",
      "wallet.orderTotal": "주문 금액",
      "wallet.balanceAfter": "주문 후 잔액",
      "order.review": "주문 확인",
      "order.place": "주문하기",
      "order.clear": "장바구니 비우기",
      "order.confirmFor": "{name}님의 주문을 확인해 주세요",
      "order.sending": "주문을 전송하고 있습니다...",
      "order.number": "주문번호 #{number}",
      "order.total": "합계: {total}",
      "confirmation.thankYou": "감사합니다",
      "confirmation.received": "주문이 접수되었습니다!",
      "confirmation.wait": "주문하신 음료를 기다려 주세요.",
      "confirmation.newOrder": "새 주문 시작",
      "confirmation.balance": "Elim 잔액: {balance}",
      "validation.addItem": "메뉴를 한 개 이상 선택해 주세요.",
      "validation.enterName": "주문 전에 이름을 입력해 주세요.",
      "error.serviceUnavailable": "현재 주문을 이용할 수 없습니다. 카페 담당자에게 문의해 주세요.",
      "error.orderFailed": "주문을 저장하지 못했습니다. 다시 시도해 주세요.",
      "aria.quantity": "{item} 수량",
      "aria.cartQuantity": "장바구니의 {item} 수량",
      "aria.addOne": "{item} 한 개 추가",
      "aria.removeOne": "{item} 한 개 빼기"
    },
    zh: {
      "header.welcome": "欢迎来到",
      "header.tagline": "好咖啡 · 更明亮的一天",
      "header.note": "每一杯都带来\n一点美好",
      "language.selector": "选择语言",
      "menu.eyebrow": "今日菜单",
      "menu.intro": "选择喜欢的饮品，让今天更加美好！",
      "category.coffee": "咖啡",
      "category.latte": "拿铁",
      "category.ade": "水果气泡饮",
      "category.coffeeDescription": "醇厚风味，美好一天",
      "category.latteDescription": "柔滑香浓，随时都是好选择",
      "category.adeDescription": "清新果味，点亮每一天",
      "category.defaultDescription": "用心制作",
      "variant.hot": "热",
      "variant.ice": "冰",
      "cart.eyebrow": "您的订单",
      "cart.title": "购物车",
      "cart.itemCountOne": "{count} 件",
      "cart.itemCountMany": "{count} 件",
      "cart.empty": "您选择的饮品将显示在这里。",
      "cart.total": "合计",
      "cart.remove": "删除",
      "customer.name": "您的姓名",
      "customer.namePlaceholder": "请输入姓名",
      "auth.account": "账户",
      "auth.title": "客户账户",
      "auth.signIn": "登录",
      "auth.signUp": "注册",
      "auth.signOut": "退出登录",
      "auth.createAccount": "创建账户",
      "auth.name": "姓名",
      "auth.email": "电子邮箱",
      "auth.password": "密码",
      "auth.confirmPassword": "确认密码",
      "auth.namePlaceholder": "您的姓名",
      "auth.emailPlaceholder": "电子邮箱地址",
      "auth.passwordPlaceholder": "至少 6 个字符",
      "auth.confirmPasswordPlaceholder": "请再次输入密码",
      "auth.checking": "正在检查您的账户...",
      "auth.balance": "Elim 余额",
      "auth.hello": "您好，{name}",
      "auth.mode": "账户操作",
      "auth.close": "关闭",
      "auth.signingIn": "正在登录...",
      "auth.creating": "正在创建账户...",
      "auth.checkEmail": "账户已创建。请使用收件箱中的链接确认电子邮箱。",
      "auth.signInFailed": "无法登录，请检查电子邮箱和密码。",
      "auth.signUpFailed": "无法创建账户，请检查填写的信息。",
      "auth.profileFailed": "无法加载账户信息，请重试。",
      "auth.callbackFailed": "无法完成电子邮箱确认。",
      "auth.passwordMismatch": "两次输入的密码不一致。",
      "auth.inactive": "此客户账户未启用，请联系咖啡厅工作人员。",
      "auth.sessionFailed": "无法恢复已保存的登录状态，请重新登录。",
      "notification.enable": "开启订单完成通知",
      "notification.disable": "关闭通知",
      "notification.enabling": "正在开启通知...",
      "notification.enabled": "订单完成通知已开启。",
      "notification.disabled": "订单完成通知已关闭。",
      "notification.unsupported": "此设备不支持网页推送通知。",
      "notification.denied": "未获得通知权限。您仍可正常下单。",
      "notification.error": "无法设置通知。",
      "ready.title": "您的订单已准备好！",
      "ready.body": "请到咖啡厅柜台取餐。",
      "ready.order": "订单 #{number}",
      "ready.close": "关闭",
      "wallet.currentBalance": "当前余额",
      "wallet.orderTotal": "订单金额",
      "wallet.balanceAfter": "下单后余额",
      "order.review": "核对订单",
      "order.place": "提交订单",
      "order.clear": "清空购物车",
      "order.confirmFor": "确认 {name} 的订单",
      "order.sending": "正在提交您的订单...",
      "order.number": "订单 #{number}",
      "order.total": "合计：{total}",
      "confirmation.thankYou": "谢谢",
      "confirmation.received": "订单已收到！",
      "confirmation.wait": "请稍候，您的饮品正在准备中。",
      "confirmation.newOrder": "开始新订单",
      "confirmation.balance": "Elim 余额：{balance}",
      "validation.addItem": "请至少选择一件商品。",
      "validation.enterName": "请在下单前输入您的姓名。",
      "error.serviceUnavailable": "目前无法提交订单，请向咖啡厅工作人员寻求帮助。",
      "error.orderFailed": "订单保存失败，请重试。",
      "aria.quantity": "{item} 数量",
      "aria.cartQuantity": "购物车中 {item} 的数量",
      "aria.addOne": "添加一份 {item}",
      "aria.removeOne": "减少一份 {item}"
    }
  };

  function readSavedLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return Object.prototype.hasOwnProperty.call(translations, saved) ? saved : DEFAULT_LANGUAGE;
    } catch (error) {
      console.warn("Could not read saved language:", error);
      return DEFAULT_LANGUAGE;
    }
  }

  let currentLanguage = readSavedLanguage();

  function translate(key, variables = {}) {
    const template = translations[currentLanguage]?.[key]
      ?? translations[DEFAULT_LANGUAGE]?.[key]
      ?? key;

    return Object.entries(variables).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template
    );
  }

  function applyStaticTranslations(root = document) {
    document.documentElement.lang = LANGUAGE_TAGS[currentLanguage];

    root.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", translate(element.dataset.i18nPlaceholder));
    });

    root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
    });

    root.querySelectorAll("[data-language]").forEach((button) => {
      const isActive = button.dataset.language === currentLanguage;
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function setLanguage(language) {
    if (!Object.prototype.hasOwnProperty.call(translations, language)) return;

    currentLanguage = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.warn("Could not save selected language:", error);
    }

    applyStaticTranslations();
    document.dispatchEvent(new CustomEvent("elim:languagechange", {
      detail: { language }
    }));
  }

  document.addEventListener("click", (event) => {
    const languageButton = event.target.closest("[data-language]");
    if (languageButton) setLanguage(languageButton.dataset.language);
  });

  window.ELIM_I18N = {
    applyStaticTranslations,
    getLanguage: () => currentLanguage,
    setLanguage,
    t: translate
  };

  applyStaticTranslations();
})();
