# Firebase Config Files Setup - Step by Step Guide

This guide walks you through downloading and configuring Firebase config files for both Android and iOS.

## 📱 Part 1: Android - google-services.json

### Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Sign in with your Google account
3. Select your project: **TeachersHubb** (or your project name)

### Step 2: Navigate to Project Settings

1. **Click the gear icon (⚙️)** next to "Project Overview" in the left sidebar
2. Or click **"Project Settings"** from the dropdown menu

### Step 3: Add Android App (if not already added)

**If you haven't added Android app yet:**

1. Scroll down to **"Your apps"** section
2. Click **"Add app"** or the **Android icon (🤖)**
3. Fill in the details:
   - **Android package name**: Find this in your `android/app/build.gradle` file
     - Look for `applicationId` (e.g., `com.teachershubb.app`)
   - **App nickname** (optional): e.g., "TeachersHubb Android"
   - **Debug signing certificate SHA-1** (optional for now)
4. Click **"Register app"**

### Step 4: Download google-services.json

1. After registering (or if app already exists), you'll see **"Download google-services.json"** button
2. **Click "Download google-services.json"**
3. The file will download to your computer

### Step 5: Place File in Android Project

1. **Locate your downloaded file**: `google-services.json`
2. **Copy the file**
3. **Navigate to your project folder**: `your-app/android/app/`
4. **Paste** `google-services.json` directly into the `android/app/` folder

**File structure should look like:**
```
your-app/
  android/
    app/
      google-services.json  ← Place it here
      build.gradle
      src/
      ...
```

### Step 6: Update Android build.gradle

1. **Open** `android/build.gradle` (project-level, not app-level)
2. **Add** Google Services plugin to `dependencies`:

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:7.4.2'
        classpath 'com.google.gms:google-services:4.4.0'  // Add this line
    }
}
```

3. **Open** `android/app/build.gradle` (app-level)
4. **Add** at the very bottom of the file:

```gradle
apply plugin: 'com.google.gms.google-services'
```

**Important:** This line must be at the **bottom** of the file, after all other plugins.

### Step 7: Sync Gradle

1. In Android Studio: Click **"Sync Now"** when prompted
2. Or run: `./gradlew build` in terminal

---

## 🍎 Part 2: iOS - GoogleService-Info.plist

### Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **TeachersHubb**

### Step 2: Navigate to Project Settings

1. **Click the gear icon (⚙️)** next to "Project Overview"
2. Or click **"Project Settings"**

### Step 3: Add iOS App (if not already added)

**If you haven't added iOS app yet:**

1. Scroll down to **"Your apps"** section
2. Click **"Add app"** or the **iOS icon (🍎)**
3. Fill in the details:
   - **iOS bundle ID**: Find this in your iOS project
     - Open `ios/App/App.xcodeproj` in Xcode
     - Select project → General tab → Bundle Identifier
     - Or check `ios/App/App/Info.plist` → `CFBundleIdentifier`
     - Example: `com.teachershubb.app`
   - **App nickname** (optional): e.g., "TeachersHubb iOS"
   - **App Store ID** (optional, leave blank for now)
4. Click **"Register app"**

### Step 4: Download GoogleService-Info.plist

1. After registering (or if app already exists), you'll see **"Download GoogleService-Info.plist"** button
2. **Click "Download GoogleService-Info.plist"**
3. The file will download to your computer

### Step 5: Add File to Xcode Project

**Method 1: Using Xcode (Recommended)**

1. **Open your iOS project** in Xcode:
   ```bash
   open ios/App/App.xcworkspace
   ```
   (Use `.xcworkspace`, not `.xcodeproj`)

2. **In Xcode:**
   - Right-click on **"App"** folder in Project Navigator (left sidebar)
   - Select **"Add Files to App..."**
   - Navigate to downloaded `GoogleService-Info.plist`
   - **IMPORTANT:** Check these options:
     - ✅ **"Copy items if needed"** (if file is outside project folder)
     - ✅ **"Add to targets: App"**
   - Click **"Add"**

3. **Verify file is added:**
   - File should appear in Project Navigator under "App" folder
   - File should be visible in Xcode

**Method 2: Manual Copy (Alternative)**

1. **Copy** downloaded `GoogleService-Info.plist`
2. **Paste** into: `ios/App/App/GoogleService-Info.plist`
3. **Open Xcode** → Project Navigator
4. **Right-click** "App" folder → **"Add Files to App..."**
5. Select the file → Check **"Add to targets: App"** → **"Add"**

### Step 6: Verify File Location

**File structure should look like:**
```
ios/
  App/
    App/
      GoogleService-Info.plist  ← Should be here
      Info.plist
      AppDelegate.swift
      ...
```

### Step 7: Install Firebase iOS SDK (if not done)

**Using CocoaPods (Recommended):**

1. **Open** `ios/App/Podfile`
2. **Add** Firebase pod:

```ruby
platform :ios, '13.0'
use_frameworks!
inhibit_all_warnings!

target 'App' do
  pod 'Firebase/Messaging'  # Add this line
  # ... other pods
end
```

3. **Run** in terminal:
```bash
cd ios/App
pod install
```

**Or add via Xcode Package Manager:**
1. Open Xcode
2. File → Add Packages
3. Search: `https://github.com/firebase/firebase-ios-sdk`
4. Add `FirebaseMessaging`

---

## ✅ Verification Steps

### Android Verification

1. **Check file exists:**
   ```bash
   ls android/app/google-services.json
   ```

2. **Check build.gradle:**
   - `android/build.gradle` has `google-services` classpath
   - `android/app/build.gradle` has `apply plugin: 'com.google.gms.google-services'` at bottom

3. **Build project:**
   ```bash
   cd android
   ./gradlew build
   ```
   Should build without errors related to Firebase.

### iOS Verification

1. **Check file exists:**
   ```bash
   ls ios/App/App/GoogleService-Info.plist
   ```

2. **Check in Xcode:**
   - File appears in Project Navigator
   - File is added to App target (check Target Membership)

3. **Build project:**
   ```bash
   cd ios/App
   xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug
   ```
   Should build without errors.

---

## 🔍 Finding Your Package/Bundle IDs

### Android Package Name

**Location:** `android/app/build.gradle`

Look for:
```gradle
android {
    defaultConfig {
        applicationId "com.teachershubb.app"  ← This is your package name
    }
}
```

### iOS Bundle ID

**Method 1: Xcode**
1. Open `ios/App/App.xcworkspace`
2. Select project in Navigator
3. Select "App" target
4. General tab → Bundle Identifier

**Method 2: Info.plist**
1. Open `ios/App/App/Info.plist`
2. Look for `CFBundleIdentifier` key

**Method 3: Terminal**
```bash
grep -r "CFBundleIdentifier" ios/App/App/Info.plist
```

---

## 🚨 Common Issues & Solutions

### Android Issues

**Issue: "google-services.json not found"**
- ✅ Ensure file is in `android/app/` (not `android/`)
- ✅ File name is exactly `google-services.json` (case-sensitive)
- ✅ Run `npx cap sync android`

**Issue: "Plugin with id 'com.google.gms.google-services' not found"**
- ✅ Add `classpath 'com.google.gms:google-services:4.4.0'` to `android/build.gradle`
- ✅ Sync Gradle

### iOS Issues

**Issue: "GoogleService-Info.plist not found"**
- ✅ Ensure file is added to Xcode project (not just copied)
- ✅ Check "Add to targets: App" is checked
- ✅ File is in `ios/App/App/` folder

**Issue: Build errors related to Firebase**
- ✅ Install Firebase pods: `pod install`
- ✅ Use `.xcworkspace` file (not `.xcodeproj`)
- ✅ Clean build folder: Product → Clean Build Folder

---

## 📋 Quick Checklist

### Android
- [ ] Added Android app in Firebase Console
- [ ] Downloaded `google-services.json`
- [ ] Placed file in `android/app/`
- [ ] Added Google Services plugin to `android/build.gradle`
- [ ] Applied plugin in `android/app/build.gradle`
- [ ] Synced Gradle successfully

### iOS
- [ ] Added iOS app in Firebase Console
- [ ] Downloaded `GoogleService-Info.plist`
- [ ] Added file to Xcode project
- [ ] File added to App target
- [ ] Installed Firebase pods
- [ ] Build succeeds

---

## 🎯 Next Steps

After configuring both files:

1. **Run** `npx cap sync` to sync native projects
2. **Test** push notifications in your app
3. **Verify** device registration works
4. **Send** test notification from Firebase Console

---

## 📚 Additional Resources

- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)

