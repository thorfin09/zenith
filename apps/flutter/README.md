# Zenith Mobile 📱

[![Flutter](https://img.shields.io/badge/Flutter-v3.22.0+-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev)
[![Android](https://img.shields.io/badge/Android-Supported-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://developer.android.com)
[![Download APK](https://img.shields.io/badge/Download-APK-success?style=for-the-badge&logo=android&logoColor=white)](https://github.com/thorfin09/zenith-flutter-/releases/download/v1.0.0/app-release.apk)

Zenith Mobile is the native Android client companion to the Zenith Task Planner suite. Beautifully built in Flutter, it synchronizes your daily planner, tasks, and history natively with the Zenith production cloud server.

---

## 📥 Direct Download

You can download and install the mobile app directly on your Android phone:

👉 **[Download Zenith Mobile APK (v1.0.0)](https://github.com/thorfin09/zenith-flutter-/releases/download/v1.0.0/app-release.apk)**

---

## ✨ Features

- **Inline Task Actions:** Add, toggle, and edit descriptions directly inline without intrusive dialog boxes.
- **Dynamic Horizontal Date Strip:** Navigating dates centers selected cards automatically; today's date aligns to the far-left on startup.
- **Native Google Sign-In:** Authenticate securely using your Gmail credentials.
- **Premium Fluid Animations:** Built-in scale, shadow, and slide transitions using custom curves for a Play Store-grade feel.
- **Real-time Sync:** Synchronizes with your account database immediately.

---

## 🛠️ Setup & Compilation

If you want to run or modify this project locally, follow these instructions:

### Prerequisites
- Flutter SDK (v3.22+)
- Android SDK & Build Tools

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/thorfin09/zenith-flutter-.git
   cd zenith-flutter-
   ```
2. Retrieve packages:
   ```bash
   flutter pub get
   ```
3. Run the development build:
   ```bash
   flutter run
   ```
4. Build the final release APK:
   ```bash
   flutter build apk --release
   ```
