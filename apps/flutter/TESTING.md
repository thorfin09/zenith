# 📱 Testing the Zenith Flutter App

This guide walks you through setting up your environment, running the app on an Android Emulator or physical device, and compiling the final APK.

---

## 🛠️ Step 1: Install the Flutter SDK

Since Flutter is not yet installed on your system, you must set it up first:

1. **Download the Flutter SDK**:
   - Go to [Flutter's Windows Install Guide](https://docs.flutter.dev/get-started/install/windows/desktop?tab=download).
   - Download the latest stable Flutter SDK zip file.
2. **Extract the SDK**:
   - Extract the zip file to a folder like `C:\flutter`.
3. **Configure System PATH**:
   - Open the Windows Start Menu, search for **"Edit the system environment variables"**, and open it.
   - Click **Environment Variables...**.
   - Under **User variables**, select **Path** and click **Edit...**.
   - Click **New** and add: `C:\flutter\bin`
   - Click **OK** to save all dialogs.
4. **Verify Installation**:
   - Open a fresh PowerShell/CMD terminal and run:
     ```powershell
     flutter doctor
     ```
     This checks if your Android toolchain is set up. Install any recommended Android SDK tools if prompted.

---

## 🏗️ Step 2: Initialize Platform Folders

Our directory contains the cross-platform Dart code. We must generate the native Android platform wrapper:

1. Open a terminal and navigate to the `flutter` directory:
   ```powershell
   cd "d:\antigravity projects\zenith\flutter"
   ```
2. Generate native wrappers:
   ```powershell
   flutter create --org com.example --project-name zenith .
   ```
3. Fetch the required dependencies (`http`, `shared_preferences`, `intl`, `flutter_dotenv`):
   ```powershell
   flutter pub get
   ```

---

## 📡 Step 3: Configure the API URL

Open `flutter/.env` to configure where the app sends API calls:

*   **To test with the local Express server on Android Emulator**:
    Set the API URL to:
    ```env
    VITE_API_URL=http://10.0.2.2:5000/api
    ```
    *(Note: `10.0.2.2` is a virtual router address that points to your computer's `localhost`)*
*   **To test with the local Express server on a physical Android phone**:
    Change `10.0.2.2` to your computer's local IP address (e.g. `http://192.168.1.15:5000/api`). Ensure your phone is connected to the same Wi-Fi network.
*   **To test using the production hosted server**:
    Keep the default URL:
    ```env
    VITE_API_URL=https://zenith-1-wrur.onrender.com:5000/api
    ```

---

## 🚀 Step 4: Run the App on a Device

1. **Launch a Device**:
   - **Android Emulator**: Open Android Studio, select **Virtual Device Manager**, and launch your emulator.
   - **Physical Device**: Connect an Android phone via USB. Ensure **USB Debugging** is enabled in Developer Options.
2. **Start the Application**:
   - Run the following command inside the `flutter` directory:
     ```powershell
     flutter run
     ```
   - If multiple devices are available, you will be prompted to select one.
3. Test logging in, registering, theme switching, or running in **Demo Mode**!

---

## 📦 Step 5: Build the Release APK

When you are ready to compile the final `.apk` file:

1. In the `flutter` directory, run:
   ```powershell
   flutter build apk --release
   ```
2. Once the build is complete, you can find your installer APK at:
   `flutter\build\app\outputs\flutter-apk\app-release.apk`
3. Copy this file to any Android device and open it to install Zenith!
