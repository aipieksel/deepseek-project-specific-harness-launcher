// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "DeepSeekHarnessLauncher",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "DeepSeekHarnessLauncher",
            targets: ["DeepSeekHarnessLauncher"]
        )
    ],
    targets: [
        .executableTarget(
            name: "DeepSeekHarnessLauncher",
            path: "Sources"
        )
    ]
)
