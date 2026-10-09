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
      "payment.title": "Zahlungsart",
      "payment.paypal": "PayPal",
      "payment.sepa": "SEPA-Überweisung",
      "payment.cash": "Barzahlung",
      "payment.paypalScan": "Bitte scanne den PayPal-QR-Code an der Café-Theke und sende deine Zahlung.",
      "payment.paypalAlternative": "Alternativ kannst du die Zahlung direkt an das folgende PayPal-Konto senden.",
      "payment.paypalAccount": "PayPal-Konto",
      "payment.sepaScan": "Bitte scanne den Überweisungs-QR-Code an der Café-Theke.",
      "payment.sepaAlternative": "Alternativ kannst du die Zahlung direkt mit den folgenden Bankdaten überweisen.",
      "payment.bankName": "Bank",
      "payment.accountHolder": "Kontoinhaber",
      "payment.iban": "IBAN",
      "payment.totalAmount": "Gesamtbetrag",
      "payment.copy": "Kopieren",
      "payment.cashInstruction": "Bitte bezahle bar an der Café-Theke.",
      "order.review": "Bestellung prüfen",
      "order.place": "Bestellung aufgeben",
      "order.clear": "Warenkorb leeren",
      "order.confirmFor": "Bestellung für {name} bestätigen",
      "order.paymentMethod": "Zahlungsart",
      "order.sending": "Deine Bestellung wird gesendet...",
      "order.number": "Bestellung #{number}",
      "order.total": "Gesamt: {total}",
      "confirmation.thankYou": "Vielen Dank",
      "confirmation.received": "Bestellung erhalten!",
      "confirmation.wait": "Bitte warte auf deine Bestellung.",
      "confirmation.newOrder": "Neue Bestellung starten",
      "validation.addItem": "Bitte füge mindestens einen Artikel hinzu.",
      "validation.enterName": "Bitte gib vor der Bestellung deinen Namen ein.",
      "validation.selectPayment": "Bitte wähle vor der Bestellung eine Zahlungsart aus.",
      "error.serviceUnavailable": "Bestellungen sind momentan nicht verfügbar. Bitte wende dich an das Café-Team.",
      "error.orderFailed": "Die Bestellung konnte nicht gespeichert werden. Bitte versuche es erneut.",
      "copy.ibanSuccess": "IBAN kopiert.",
      "copy.accountHolderSuccess": "Kontoinhaber kopiert.",
      "copy.failed": "Automatisches Kopieren war nicht möglich. Bitte markiere und kopiere den Text.",
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
      "payment.title": "Payment method",
      "payment.paypal": "PayPal",
      "payment.sepa": "SEPA bank transfer",
      "payment.cash": "Cash",
      "payment.paypalScan": "Please scan the PayPal QR code displayed at the café counter and send your payment.",
      "payment.paypalAlternative": "Alternatively, you can send the payment directly to the following PayPal account.",
      "payment.paypalAccount": "PayPal account",
      "payment.sepaScan": "Please scan the bank transfer QR code displayed at the café counter.",
      "payment.sepaAlternative": "Alternatively, you can transfer the payment directly using the following bank details.",
      "payment.bankName": "Bank name",
      "payment.accountHolder": "Account holder",
      "payment.iban": "IBAN",
      "payment.totalAmount": "Total amount",
      "payment.copy": "Copy",
      "payment.cashInstruction": "Please pay in cash at the café counter.",
      "order.review": "Review Order",
      "order.place": "Place Order",
      "order.clear": "Clear Cart",
      "order.confirmFor": "Confirm order for {name}",
      "order.paymentMethod": "Payment method",
      "order.sending": "Sending your order...",
      "order.number": "Order #{number}",
      "order.total": "Total: {total}",
      "confirmation.thankYou": "Thank you",
      "confirmation.received": "Order received!",
      "confirmation.wait": "Please wait for your order.",
      "confirmation.newOrder": "Start another order",
      "validation.addItem": "Please add at least one item.",
      "validation.enterName": "Please enter your name before ordering.",
      "validation.selectPayment": "Please select a payment method before ordering.",
      "error.serviceUnavailable": "Ordering is currently unavailable. Please ask the café team for help.",
      "error.orderFailed": "Could not save your order. Please try again.",
      "copy.ibanSuccess": "IBAN copied.",
      "copy.accountHolderSuccess": "Account holder copied.",
      "copy.failed": "Could not copy automatically. Please select and copy the text.",
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
      "payment.title": "결제 방법",
      "payment.paypal": "PayPal",
      "payment.sepa": "SEPA 계좌이체",
      "payment.cash": "현금",
      "payment.paypalScan": "카페 카운터에 있는 PayPal QR 코드를 스캔하여 결제해 주세요.",
      "payment.paypalAlternative": "또는 아래 PayPal 계정으로 직접 결제할 수 있습니다.",
      "payment.paypalAccount": "PayPal 계정",
      "payment.sepaScan": "카페 카운터에 있는 계좌이체 QR 코드를 스캔해 주세요.",
      "payment.sepaAlternative": "또는 아래 은행 정보로 직접 이체할 수 있습니다.",
      "payment.bankName": "은행명",
      "payment.accountHolder": "예금주",
      "payment.iban": "IBAN",
      "payment.totalAmount": "총 주문 금액",
      "payment.copy": "복사",
      "payment.cashInstruction": "카페 카운터에서 현금으로 결제해 주세요.",
      "order.review": "주문 확인",
      "order.place": "주문하기",
      "order.clear": "장바구니 비우기",
      "order.confirmFor": "{name}님의 주문을 확인해 주세요",
      "order.paymentMethod": "결제 방법",
      "order.sending": "주문을 전송하고 있습니다...",
      "order.number": "주문번호 #{number}",
      "order.total": "합계: {total}",
      "confirmation.thankYou": "감사합니다",
      "confirmation.received": "주문이 접수되었습니다!",
      "confirmation.wait": "주문하신 음료를 기다려 주세요.",
      "confirmation.newOrder": "새 주문 시작",
      "validation.addItem": "메뉴를 한 개 이상 선택해 주세요.",
      "validation.enterName": "주문 전에 이름을 입력해 주세요.",
      "validation.selectPayment": "주문 전에 결제 방법을 선택해 주세요.",
      "error.serviceUnavailable": "현재 주문을 이용할 수 없습니다. 카페 담당자에게 문의해 주세요.",
      "error.orderFailed": "주문을 저장하지 못했습니다. 다시 시도해 주세요.",
      "copy.ibanSuccess": "IBAN을 복사했습니다.",
      "copy.accountHolderSuccess": "예금주를 복사했습니다.",
      "copy.failed": "자동으로 복사하지 못했습니다. 텍스트를 선택하여 복사해 주세요.",
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
      "payment.title": "付款方式",
      "payment.paypal": "PayPal",
      "payment.sepa": "SEPA 银行转账",
      "payment.cash": "现金",
      "payment.paypalScan": "请扫描咖啡厅柜台展示的 PayPal 二维码并付款。",
      "payment.paypalAlternative": "您也可以直接向以下 PayPal 账户付款。",
      "payment.paypalAccount": "PayPal 账户",
      "payment.sepaScan": "请扫描咖啡厅柜台展示的银行转账二维码。",
      "payment.sepaAlternative": "您也可以使用以下银行信息直接转账。",
      "payment.bankName": "银行名称",
      "payment.accountHolder": "账户持有人",
      "payment.iban": "IBAN",
      "payment.totalAmount": "订单总额",
      "payment.copy": "复制",
      "payment.cashInstruction": "请在咖啡厅柜台使用现金付款。",
      "order.review": "核对订单",
      "order.place": "提交订单",
      "order.clear": "清空购物车",
      "order.confirmFor": "确认 {name} 的订单",
      "order.paymentMethod": "付款方式",
      "order.sending": "正在提交您的订单...",
      "order.number": "订单 #{number}",
      "order.total": "合计：{total}",
      "confirmation.thankYou": "谢谢",
      "confirmation.received": "订单已收到！",
      "confirmation.wait": "请稍候，您的饮品正在准备中。",
      "confirmation.newOrder": "开始新订单",
      "validation.addItem": "请至少选择一件商品。",
      "validation.enterName": "请在下单前输入您的姓名。",
      "validation.selectPayment": "请在下单前选择付款方式。",
      "error.serviceUnavailable": "目前无法提交订单，请向咖啡厅工作人员寻求帮助。",
      "error.orderFailed": "订单保存失败，请重试。",
      "copy.ibanSuccess": "已复制 IBAN。",
      "copy.accountHolderSuccess": "已复制账户持有人。",
      "copy.failed": "无法自动复制，请选择并复制文本。",
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
