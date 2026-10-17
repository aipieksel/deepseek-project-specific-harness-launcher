import Foundation

struct HarnessProject: Identifiable, Hashable {
    let id: UUID
    var name: String
    var path: String
    var port: Int
    var disableTokenAuth: Bool

    init(
        id: UUID = UUID(),
        name: String,
        path: String,
        port: Int,
        disableTokenAuth: Bool = false
    ) {
        self.id = id
        self.name = name
        self.path = path
        self.port = port
        self.disableTokenAuth = disableTokenAuth
    }

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !path.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            (1...65535).contains(port)
    }
}
