import Foundation

private struct TokenReply: Decodable { let token: String }
private struct EmptyBody: Encodable {}
private struct TextBody: Encodable { let body: String }
private struct PrayerBody: Encodable { let serve: String; let contact: Bool; let body: String; let visibility: String }
private struct StreakReply: Decodable { let streak: Int }
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

    func submitPrayer(token: String, serve: String, contact: Bool, body: String) async throws {
        let _: EmptyReply = try await send(
            "/api/prayers",
            method: "POST",
            token: token,
            json: JSONEncoder().encode(PrayerBody(serve: serve, contact: contact, body: body, visibility: "public"))
        )
    }

    /// Sends a next step to the staff follow-up queue. `token` is nil for a guest.
    func submitFollowUp(token: String?, request: FollowUpRequest) async throws {
        let _: EmptyReply = try await send("/api/follow-ups", method: "POST", token: token, json: JSONEncoder().encode(request))
    }

    /// Sends the church's Support/Assistance Request to the staff care queue. `token` is nil for a guest.
    func submitSupport(token: String?, request: SupportRequest) async throws {
        let _: EmptyReply = try await send("/api/support", method: "POST", token: token, json: JSONEncoder().encode(request))
    }

    /// Confirms the password (giving is a sensitive record), then records the gift.
    func give(token: String, request: GiftRequest, password: String) async throws {
        try await stepUp(token: token, password: password)
        let _: EmptyReply = try await send("/api/giving/gifts", method: "POST", token: token, json: JSONEncoder().encode(request))
    }

    /// Marks today's Daily Word read and returns the member's synced streak.
    func markDailyWordRead(token: String) async throws -> Int {
        let reply: StreakReply = try await send("/api/daily-word/read", method: "POST", token: token, json: Data("{}".utf8))
        return reply.streak
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

public extension ChurchClient {
    /// Runs one action and returns what to tell the person. Next steps and support requests work without an account.
    func run(_ action: MemberAction, token: String?) async throws -> String {
        switch action {
        case let .followUp(request):
            try await submitFollowUp(token: token, request: request)
            return FollowUpKind(rawValue: request.kind)?.thanks ?? "Sent."
        case let .support(request):
            try await submitSupport(token: token, request: request)
            return "Thank you. Someone from One Hope will contact you soon."
        default:
            break
        }
        guard let token else {
            throw ChurchAPIError(status: 401, code: "sign_in_needed", message: "Please sign in first, from the Connect tab.")
        }
        if let reply = try await runKids(action, token: token) {
            return reply
        }
        return try await runChurch(action, token: token)
    }

    private func runChurch(_ action: MemberAction, token: String) async throws -> String {
        switch action {
        case let .join(id):
            try await join(token: token, groupId: id)
            return "You're in that group."
        case let .message(id, body):
            try await postMessage(token: token, groupId: id, body: body)
            return "Your note was sent."
        case let .register(id):
            try await register(token: token, eventId: id)
            return "You're registered."
        case let .prayer(serve, contact, body):
            try await submitPrayer(token: token, serve: serve, contact: contact, body: body)
            return "Your prayer request was sent to the pastors."
        case .readDailyWord:
            let streak = try await markDailyWordRead(token: token)
            return streak == 1 ? "1 day in a row" : "\(streak) days in a row"
        case let .gift(request, password):
            try await give(token: token, request: request, password: password)
            return "Thank you. Your gift is set up (\(request.recurring.label.lowercased()))."
        case .followUp, .support, .addChild, .checkIn, .pickup:
            return ""
        }
    }

    private func runKids(_ action: MemberAction, token: String) async throws -> String? {
        switch action {
        case let .addChild(name, classroom):
            _ = try await addChild(token: token, displayName: name, classroom: classroom)
            return "\(name) was added."
        case let .checkIn(id):
            let code = try await checkIn(token: token, childId: id)
            return "Checked in. Security code \(code). Keep it for pickup."
        case let .pickup(id, code):
            return try await householdPickup(token: token, childId: id, code: code)
        default:
            return nil
        }
    }
}
