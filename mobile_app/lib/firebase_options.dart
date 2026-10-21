import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
///
/// Generated for project: capital-talabat
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCTgSsfVgXrd4d79-wpRtCBY-biXnVTeM8',
    appId: '1:462331103510:web:b48e42c27667fcdee9e837',
    messagingSenderId: '462331103510',
    projectId: 'capital-talabat',
    authDomain: 'capital-talabat.firebaseapp.com',
    storageBucket: 'capital-talabat.firebasestorage.app',
    measurementId: 'G-NRB4FGWKYM',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyC8riMf-65g49IqPvT_Ug2DD-X-cluDm54',
    appId: '1:462331103510:android:bbcec7992b9a9b08e9e837',
    messagingSenderId: '462331103510',
    projectId: 'capital-talabat',
    storageBucket: 'capital-talabat.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyC8riMf-65g49IqPvT_Ug2DD-X-cluDm54',
    appId: '1:462331103510:android:bbcec7992b9a9b08e9e837',
    messagingSenderId: '462331103510',
    projectId: 'capital-talabat',
    storageBucket: 'capital-talabat.firebasestorage.app',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyC8riMf-65g49IqPvT_Ug2DD-X-cluDm54',
    appId: '1:462331103510:android:bbcec7992b9a9b08e9e837',
    messagingSenderId: '462331103510',
    projectId: 'capital-talabat',
    storageBucket: 'capital-talabat.firebasestorage.app',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyCTgSsfVgXrd4d79-wpRtCBY-biXnVTeM8',
    appId: '1:462331103510:web:b48e42c27667fcdee9e837',
    messagingSenderId: '462331103510',
    projectId: 'capital-talabat',
    authDomain: 'capital-talabat.firebaseapp.com',
    storageBucket: 'capital-talabat.firebasestorage.app',
  );
}
