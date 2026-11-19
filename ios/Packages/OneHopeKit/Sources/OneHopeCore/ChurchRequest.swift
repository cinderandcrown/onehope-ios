import Foundation

/// Read cache age for the last response served from this phone.
public actor CacheAge {
    private var note = ""

    public init() {}

    func record(seconds: Int) {
        note = "Last updated \(seconds) seconds ago, saved on this phone."
    }

    func clear() {
        note = ""
    }

    public func consume() -> String {
        let current = note
        note = ""
        return current
    }
}

enum OfflineWritePolicy {
    /// Pickup release and giving never use a saved response. They need the server.
    static func failsClosed(path: String) -> Bool {
        path == "/api/kids/pickup" || path == "/api/kids/household-pickup" || path == "/api/giving/gifts"
    }
}

enum ChurchRequest {
    struct Call {
        let baseURL: URL
        let transport: any HTTPTransport
        let cache: ResponseCache?
        let cacheAge: CacheAge
        let path: String
        let method: String
        let token: String?
        let json: Data?
    }

    static func send<Response: Decodable>(_ call: Call) async throws -> Response {
        guard let url = URL(string: call.path, relativeTo: call.baseURL)?.absoluteURL else {
            throw ChurchAPIError.transport("We couldn't reach the church just now.")
        }
        do {
            let (status, data) = try await call.transport.send(url: url, method: call.method, body: call.json, bearer: call.token)
            if status >= 400 {
                let failure = try? JSONDecoder().decode(FailureBody.self, from: data)
                let message = failure?.error ?? "Request failed."
                throw ChurchAPIError(status: status, code: failure?.code ?? "error", message: message)
            }
            if call.method == "GET", let cache = call.cache {
                try? await cache.save(data, key: call.path)
                let stamp = Data(String(Int(Date().timeIntervalSince1970)).utf8)
                try? await cache.save(stamp, key: call.path + ".stamp")
            }
            await call.cacheAge.clear()
            return try decode(Response.self, from: data)
        } catch let error as ChurchAPIError where error.code == "offline" || error.code == "server" {
            let cached = await cachedGet(call)
            if let cached {
                return try decode(Response.self, from: cached)
            }
            throw error
        }
    }

    private static func cachedGet(_ call: Call) async -> Data? {
        guard call.method == "GET", !OfflineWritePolicy.failsClosed(path: call.path), let cache = call.cache else {
            return nil
        }
        guard let saved = await cache.load(key: call.path) else { return nil }
        if let stamp = await cache.load(key: call.path + ".stamp"),
           let text = String(data: stamp, encoding: .utf8),
           let then = Int(text) {
            let age = max(0, Int(Date().timeIntervalSince1970) - then)
            await call.cacheAge.record(seconds: age)
        }
        return saved
    }

    private static func decode<Response: Decodable>(_ type: Response.Type, from data: Data) throws -> Response {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw ChurchAPIError.transport("We couldn't read the church's reply. Please try again.")
        }
    }
}

struct FailureBody: Decodable {
    let error: String
    let code: String
}
