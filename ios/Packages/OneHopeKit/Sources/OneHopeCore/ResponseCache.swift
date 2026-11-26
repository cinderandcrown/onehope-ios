import Foundation

public actor ResponseCache {
    private let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    public func save(_ data: Data, key: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: file(key), options: .atomic)
    }

    public func load(key: String) -> Data? {
        try? Data(contentsOf: file(key))
    }

    private func file(_ key: String) -> URL {
        directory.appendingPathComponent(key.replacingOccurrences(of: "/", with: "_"))
    }
}
