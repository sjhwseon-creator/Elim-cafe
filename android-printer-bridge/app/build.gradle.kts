plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.elimcafe.printerbridge"
    compileSdk = 36

    defaultConfig {
        applicationId = "de.elimcafe.printerbridge"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "1.4-association-fix-test"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
