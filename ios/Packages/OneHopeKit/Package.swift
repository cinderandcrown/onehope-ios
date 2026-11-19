// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OneHopeKit",
    platforms: [.iOS(.v18)],
    products: [
        .library(name: "OneHopeCore", targets: ["OneHopeCore"]),
        .library(name: "OneHopeDesign", targets: ["OneHopeDesign"]),
        .library(name: "OneHopeHome", targets: ["OneHopeHome"]),
        .library(name: "OneHopeWatch", targets: ["OneHopeWatch"]),
        .library(name: "OneHopeGive", targets: ["OneHopeGive"]),
        .library(name: "OneHopeConnect", targets: ["OneHopeConnect"]),
        .library(name: "OneHopeMore", targets: ["OneHopeMore"]),
    ],
    targets: [
        .target(name: "OneHopeCore", resources: [.copy("Resources/youtube-player.html")]),
        .target(name: "OneHopeDesign", dependencies: ["OneHopeCore"], resources: [.process("Resources")]),
        .target(name: "OneHopeHome", dependencies: ["OneHopeCore", "OneHopeDesign"]),
        .target(name: "OneHopeWatch", dependencies: ["OneHopeCore", "OneHopeDesign", "OneHopeHome"]),
        .target(name: "OneHopeGive", dependencies: ["OneHopeCore", "OneHopeDesign"]),
        .target(name: "OneHopeConnect", dependencies: ["OneHopeCore", "OneHopeDesign"]),
        .target(name: "OneHopeMore", dependencies: ["OneHopeCore", "OneHopeDesign"]),
    ]
)
