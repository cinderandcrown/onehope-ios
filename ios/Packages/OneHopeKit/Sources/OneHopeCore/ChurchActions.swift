import Foundation

private struct TokenReply: Decodable { let token: String }
private struct EmptyBody: Encodable {}
private struct TextBody: Encodable { let body: String }
private struct PrayerBody: Encodable { let body: String; let visibility: String }
private struct ChildBody: Encodable { let displayName: String; let classroom: String }
private struct ChildCreated: Decodable { let id: String }
private struct ChildReply: Decodable { let child: ChildCreated }
private struct IdBody: Encodable { let childId: String }
private struct CodeReply: Decodable { let code: String }
private struct PickupBody: Encodable { let childId: String; let code: String }
private struct ReasonReply: Decodable { let reason: String }
private struct EmptyReply: Decodable {}

public extension ChurchClient {
    func signup(email: String, password: String, displayName: String) async throws -> String {
        struct Body: Encodable { let email: String; let password: String; let displayName: String }
        let reply: TokenReply = try await send(
            "/api/auth/signup",
            method: "POST",
            token: nil,
            json: JSONEncoder().encode(Body(email: email, password: password, displayName: displayName))
        )
        return reply.token
    }

    func logout(token: String) async {
        let _: EmptyReply? = try? await send("/api/auth/logout", method: "POST", token: token, json: JSONEncoder().encode(EmptyBody()))
    }

    func join(token: String, groupId: String) async throws {
        let _: EmptyReply = try await send("/api/groups/\(groupId)/join", method: "POST", token: token, json: Data("{}".utf8))
    }

    func postMessage(token: String, groupId: String, body: String) async throws {
        let _: EmptyReply = try await send(
            "/api/groups/\(groupId)/messages",
            method: "POST",
            token: token,
            json: JSONEncoder().encode(TextBody(body: body))
        )
    }

    func register(token: String, eventId: String) async throws {
        let _: EmptyReply = try await send("/api/events/\(eventId)/register", method: "POST", token: token, json: Data("{}".utf8))
    }

    func submitPrayer(token: String, body: String) async throws {
        let _: EmptyReply = try await send(
            "/api/prayers",
            method: "POST",
            token: token,
            json: JSONEncoder().encode(PrayerBody(body: body, visibility: "public"))
        )
    }

    func updateProfile(token: String, emailPublic: Bool, phonePublic: Bool, listed: Bool) async throws {
        struct Body: Encodable { let emailPublic: Bool; let phonePublic: Bool; let listedInDirectory: Bool }
        let _: EmptyReply = try await send(
            "/api/me",
            method: "POST",
            token: token,
            json: JSONEncoder().encode(Body(emailPublic: emailPublic, phonePublic: phonePublic, listedInDirectory: listed))
        )
    }

    func deleteAccount(token: String) async throws {
        let _: EmptyReply = try await send("/api/account/delete", method: "POST", token: token, json: Data("{}".utf8))
    }

    func addChild(token: String, displayName: String, classroom: String) async throws -> String {
        let reply: ChildReply = try await send(
            "/api/household/children",
            method: "POST",
            token: token,
            json: JSONEncoder().encode(ChildBody(displayName: displayName, classroom: classroom))
        )
        return reply.child.id
    }

    func checkIn(token: String, childId: String) async throws -> String {
        let reply: CodeReply = try await send(
            "/api/kids/check-in",
            method: "POST",
            token: token,
            json: JSONEncoder().encode(IdBody(childId: childId))
        )
        return reply.code
    }

    func householdPickup(token: String, childId: String, code: String) async throws -> String {
        let reply: ReasonReply = try await send(
            "/api/kids/household-pickup",
            method: "POST",
            token: token,
            json: JSONEncoder().encode(PickupBody(childId: childId, code: code))
        )
        return reply.reason
    }
}
