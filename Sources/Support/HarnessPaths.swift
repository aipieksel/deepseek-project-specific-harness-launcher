import Foundation

enum HarnessPaths {
    static let home = FileManager.default.homeDirectoryForCurrentUser

    static let registryURL = home
        .appendingPathComponent(".local/share/deepseek-harness/projects/projects.tsv")

    static let launcherURL = home
        .appendingPathComponent(".local/bin/dsh-project")

    static let localBinURL = home
        .appendingPathComponent(".local/bin")

    static func launchEnvironment(disableTokenAuth: Bool) -> [String: String] {
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = augmentedPATH(environment["PATH"])
        if disableTokenAuth {
            environment["DSH_DISABLE_BROWSER_TOKEN"] = "1"
        }
        return environment
    }

    static func augmentedPATH(_ current: String?) -> String {
        let extras = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            localBinURL.path,
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin"
        ]
        var seen = Set<String>()
        var parts: [String] = []
        for part in extras + (current ?? "").split(separator: ":").map(String.init) {
            guard !part.isEmpty, seen.insert(part).inserted else { continue }
            parts.append(part)
        }
        return parts.joined(separator: ":")
    }
}
