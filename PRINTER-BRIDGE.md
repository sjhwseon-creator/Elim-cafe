# Elim Café Android Printer Bridge

## Current hardware conclusion

The Z5801 should be treated as a 58mm POS-58 ESC/POS printer. The available 5801-family documentation describes ESC/POS and Bluetooth 2.0/4.0, but also mentions SPP. The printer's BLE label alone does not prove that it exposes a writable BLE GATT characteristic for raw ESC/POS bytes.

The diagnostic Android build now:

1. Scan for nearby devices and let the user select the printer currently advertised as `Printer001`.
2. Uses the selected `BluetoothDevice`; it never matches by display name.
3. Connect using BLE GATT and enumerate every service and characteristic UUID.
4. Confirm that at least one characteristic supports `WRITE` or `WRITE_NO_RESPONSE`.
5. Send the test receipt in chunks appropriate for the negotiated MTU.
6. Falls back to Bluetooth Classic SPP/RFCOMM if BLE is unavailable or unsuitable.

`Printer001` is only the currently observed display name. It must not be used as a permanent identifier. Pairing key `0000` belongs in the Android system pairing UI and must not be stored or submitted by JavaScript.

## Required Android component

The `android-printer-bridge/` project contains:

- One locked-down `WebView` that loads only the Elim Café staff HTTPS origin.
- `PrinterController` and `PrinterTransport` interfaces independent from the WebView and order code.
- `BleEscPosTransport` using `BluetoothGatt` for diagnostic GATT discovery and writes.
- `ClassicSppTransport` using an RFCOMM socket if the printer is actually SPP.
- A bridge exposed to JavaScript as `window.ElimNativePrinter`.
- A system device picker or app-owned selector; selection must be user initiated.
- Connection and print operations on background executors.
- Main-frame navigation allowlisting. External URLs must open outside the bridge-enabled WebView.

Do not expose arbitrary Bluetooth addresses, arbitrary ESC/POS commands, filesystem access, or general Android APIs through the bridge.

## JavaScript bridge contract

The native bridge must provide these annotated methods:

```text
getStatus(requestId, payloadJson)
connect(requestId, payloadJson)
disconnect(requestId, payloadJson)
printBase64(requestId, payloadJson)
printReceipt(requestId, base64OrJsonPayload)
isConnected()
```

Native results are returned by evaluating one of these page callbacks:

```js
window.elimPrinterNativeResult(requestId, resultJson);
window.elimPrinterNativeStatus(statusJson);
```

Example successful result:

```json
{
  "ok": true,
  "status": {
    "state": "connected",
    "deviceName": "Printer001",
    "message": "Printer connected."
  }
}
```

The test page sends base64-encoded ESC/POS bytes that print:

```text
ELIM CAFE
TEST PRINT
```

Live Supabase orders are intentionally not connected in this test phase.

## Build and install the test app

1. Open `android-printer-bridge` in Android Studio.
2. In **Tools > SDK Manager**, install Android 16 / API 36 SDK Platform and the current Android SDK Build-Tools. This computer currently has Android Studio but its configured SDK folder is empty.
3. Let Gradle sync, then select **Build > Build APK(s)**. The debug APK is written under `app/build/outputs/apk/debug/`.
4. Install the debug APK on the TECLAST tablet. Android may ask permission to install apps from the transfer source.
5. In Supabase **Authentication > URL Configuration**, add this exact Redirect URL: `elimcafe://auth`. Keep the normal deployed staff URL too.
6. Open **Elim Café Printer** on the tablet and sign in. The Magic Link returns to the app through the custom `elimcafe://auth` callback.
7. Press **Connect**, grant **Nearby devices**, and choose the printer from the list. `Printer001` is expected today, but the app does not depend on that name.
8. If Android asks for pairing, complete it in the Android system UI using the information printed in the hardware manual. The app never stores a pairing key.
9. Press **Test print**. The receipt payload comes from `js/receipt.js` and contains only `ELIM CAFE` and `TEST PRINT` for this phase.

For BLE diagnostics, filter Android Studio Logcat with `ElimPrinterBLE`. Every discovered GATT service and characteristic is logged with its UUID and property flags. `ElimPrinterSPP` reports RFCOMM fallback errors.

From PowerShell, `./gradlew.ps1 :app:assembleDebug` is the Unicode-path-safe build command for this repository location. The standard wrapper files are also included for Android Studio and repositories stored under an ASCII-only path.

## Android 16 permissions

For an app targeting Android 12 or newer, declare and request at runtime:

```xml
<uses-permission
    android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.INTERNET" />
```

`BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` appear to the user as the Nearby devices runtime permission. `BLUETOOTH_ADVERTISE` is not required because the tablet does not advertise itself. Location permission is not required when scan results are not used for location and `neverForLocation` is declared.

If backward compatibility below Android 12 is required, also declare legacy `BLUETOOTH`, `BLUETOOTH_ADMIN`, and location permissions with `android:maxSdkVersion="30"` as appropriate.

No foreground service is needed while printing only when the staff dashboard is open. Background printing would require a separate foreground-service design, a persistent notification, and the applicable connected-device foreground-service permissions.
