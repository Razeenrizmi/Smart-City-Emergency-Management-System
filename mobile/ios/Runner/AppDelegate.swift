import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller = window?.rootViewController as? FlutterViewController
    if let controller = controller {
      let navChannel = FlutterMethodChannel(name: "com.srms.mobile/navigation",
                                            binaryMessenger: controller.binaryMessenger)
      navChannel.setMethodCallHandler({ (call: FlutterMethodCall, result: @escaping FlutterResult) in
        if call.method == "openMap",
           let args = call.arguments as? [String: Any],
           let urlStr = args["url"] as? String,
           let url = URL(string: urlStr) {
          UIApplication.shared.open(url, options: [:]) { success in
            result(success)
          }
        } else {
          result(FlutterMethodNotImplemented)
        }
      })
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
