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
    static func send<Response: Decodable>(
        baseURL: URL,
        transport: any HTTPTransport,
        cache: ResponseCache?,
        cacheAge: CacheAge,
        path: String,
        method: String,
        token: String?,
        json: Data?
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw ChurchAPIError.transport("We couldn't reach the church just now.")
        }
        do {
            let (status, data) = try await transport.send(url: url, method: method, body: json, bearer: token)
            if status >= 400 {
                let failure = try? JSONDecoder().decode(FailureBody.self, from: data)
                throw ChurchAPIError(status: status, code: failure?.code ?? "error", message: failure?.error ?? "Request failed.")
            }
            if method == "GET", let cache {
                try? await cache.save(data, key: path)
                let stamp = Data(String(Int(Date().timeIntervalSince1970)).utf8)
                try? await cache.save(stamp, key: path + ".stamp")
            }
            await cacheAge.clear()
            return try decode(Response.self, from: data)
        } catch let error as ChurchAPIError where error.code == "offline" || error.code == "server" {
            if method == "GET", !OfflineWritePolicy.failsClosed(path: path), let cache, let saved = await cache.load(key: path) {
                if let stamp = await cache.load(key: path + ".stamp"),
                   let text = String(data: stamp, encoding: .utf8),
                   let then = Int(text) {
                    let age = max(0, Int(Date().timeIntervalSince1970) - then)
                    await cacheAge.record(seconds: age)
                }
                return try decode(Response.self, from: saved)
            }
            throw error
        }
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
