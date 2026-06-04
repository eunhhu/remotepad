import Foundation

public enum RemotePadHttpClientError: Error, Equatable, Sendable {
    case invalidHost
    case invalidURL(String)
    case httpStatus(Int)
}

public struct ServerStats: Codable, Equatable, Sendable {
    public let received: UInt64
    public let applied: UInt64
    public let malformed: UInt64
    public let stale: UInt64
    public let dropped: UInt64
    public let p99DispatchUs: UInt64?

    private enum CodingKeys: String, CodingKey {
        case received
        case applied
        case malformed
        case stale
        case dropped
        case p99DispatchUs = "p99_dispatch_us"
    }
}

public struct ClientConnectResponse: Codable, Equatable, Sendable {
    public let status: String
    public let httpPort: UInt16?
    public let udpPort: UInt16?
    public let defaultLayout: String?
}

public final class RemotePadHttpClient: @unchecked Sendable {
    public let baseURL: URL
    private let session: URLSession

    public init(host: String, port: UInt16, session: URLSession? = nil) throws {
        let trimmedHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedHost.isEmpty else {
            throw RemotePadHttpClientError.invalidHost
        }
        var components = URLComponents()
        components.scheme = "http"
        components.host = trimmedHost
        components.port = Int(port)
        guard let baseURL = components.url else {
            throw RemotePadHttpClientError.invalidURL(trimmedHost)
        }
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.timeoutIntervalForRequest = 2
            configuration.timeoutIntervalForResource = 3
            self.session = URLSession(configuration: configuration)
        }
        self.baseURL = baseURL
    }

    public func fetchHealth() async throws {
        _ = try await data(from: endpoint("healthz"))
    }

    public func connect(client: String = "ios", appVersion: String? = nil) async throws -> ClientConnectResponse {
        var request = URLRequest(url: endpoint("api/clients/connect"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ClientConnectRequest(client: client, appVersion: appVersion))
        let (data, response) = try await session.data(for: request)
        try validate(response: response)
        return try JSONDecoder().decode(ClientConnectResponse.self, from: data)
    }

    public func fetchLayout(name: String = "default") async throws -> Layout {
        try await Layout.decode(data(from: endpoint("api/layouts/\(name)")))
    }

    public func fetchStats() async throws -> ServerStats {
        try await JSONDecoder().decode(ServerStats.self, from: data(from: endpoint("api/stats")))
    }

    public func endpoint(_ path: String) -> URL {
        baseURL.appending(path: path)
    }

    private func data(from url: URL) async throws -> Data {
        let (data, response) = try await session.data(from: url)
        try validate(response: response)
        return data
    }

    private func validate(response: URLResponse) throws {
        if let httpResponse = response as? HTTPURLResponse,
           !(200..<300).contains(httpResponse.statusCode) {
            throw RemotePadHttpClientError.httpStatus(httpResponse.statusCode)
        }
    }
}

private struct ClientConnectRequest: Encodable {
    let client: String
    let appVersion: String?
}
