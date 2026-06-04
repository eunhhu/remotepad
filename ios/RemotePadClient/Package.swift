// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "RemotePadClient",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "RemotePadClient", targets: ["RemotePadClient"]),
    ],
    targets: [
        .target(name: "RemotePadClient"),
        .testTarget(name: "RemotePadClientTests", dependencies: ["RemotePadClient"]),
    ]
)
