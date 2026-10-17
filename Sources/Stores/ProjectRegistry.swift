import Combine
import Foundation

@MainActor
final class ProjectRegistry: ObservableObject {
    @Published var projects: [HarnessProject] = []
    @Published var selectedID: HarnessProject.ID?
    @Published var statusMessage = ""

    let registryURL: URL

    init(registryURL: URL = HarnessPaths.registryURL) {
        self.registryURL = registryURL
        load()
    }

    var selectedIndex: Int? {
        guard let selectedID else { return nil }
        return projects.firstIndex { $0.id == selectedID }
    }

    func selectedBinding() -> BindingProject? {
        guard let index = selectedIndex else { return nil }
        return BindingProject(registry: self, index: index)
    }

    func load() {
        do {
            let contents = try String(contentsOf: registryURL, encoding: .utf8)
            let loaded = contents
                .split(whereSeparator: \.isNewline)
                .compactMap(parseLine)

            projects = loaded
            if selectedID == nil || !loaded.contains(where: { $0.id == selectedID }) {
                selectedID = loaded.first?.id
            }
            statusMessage = "Loaded \(loaded.count) projects."
        } catch {
            projects = []
            selectedID = nil
            statusMessage = "Could not read registry: \(error.localizedDescription)"
        }
    }

    func save() {
        do {
            let directory = registryURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try serializedRegistry().write(to: registryURL, atomically: true, encoding: .utf8)
            statusMessage = "Saved \(projects.count) projects."
        } catch {
            statusMessage = "Save failed: \(error.localizedDescription)"
        }
    }

    func addProject() {
        let baseName = "new-project"
        var name = baseName
        var suffix = 2
        let existing = Set(projects.map(\.name))
        while existing.contains(name) {
            name = "\(baseName)-\(suffix)"
            suffix += 1
        }

        let nextPort = max((projects.map(\.port).max() ?? 3096) + 1, 3097)
        let project = HarnessProject(
            name: name,
            path: "/Users/Shared",
            port: nextPort,
            disableTokenAuth: false
        )
        projects.append(project)
        selectedID = project.id
        statusMessage = "Added \(name). Edit the path and save."
    }

    func deleteSelected() {
        guard let index = selectedIndex else { return }
        let removed = projects.remove(at: index)
        selectedID = projects.indices.contains(index) ? projects[index].id : projects.last?.id
        statusMessage = "Removed \(removed.name). Save to update the launcher file."
    }

    func createShortcut(for project: HarnessProject) {
        let shortcutURL = HarnessPaths.localBinURL.appendingPathComponent("dsh-\(project.name)")
        do {
            let fileManager = FileManager.default
            if fileManager.fileExists(atPath: shortcutURL.path) {
                let values = try shortcutURL.resourceValues(forKeys: [.isSymbolicLinkKey])
                guard values.isSymbolicLink == true else {
                    statusMessage = "Shortcut exists and is not a symlink: \(shortcutURL.path)"
                    return
                }
                try fileManager.removeItem(at: shortcutURL)
            }
            try fileManager.createSymbolicLink(at: shortcutURL, withDestinationURL: HarnessPaths.launcherURL)
            statusMessage = "Created shortcut dsh-\(project.name)."
        } catch {
            statusMessage = "Shortcut failed: \(error.localizedDescription)"
        }
    }

    private func parseLine(_ rawLine: Substring) -> HarnessProject? {
        let line = String(rawLine)
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.hasPrefix("#") else { return nil }

        let columns = line.split(separator: "\t", omittingEmptySubsequences: false)
        guard columns.count >= 3, let port = Int(columns[2].trimmingCharacters(in: .whitespaces)) else {
            return nil
        }

        return HarnessProject(
            name: String(columns[0]),
            path: String(columns[1]),
            port: port,
            disableTokenAuth: columns.count >= 4 && Self.isDisabledTokenAuth(columns[3])
        )
    }

    private static func isDisabledTokenAuth(_ raw: Substring) -> Bool {
        switch raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "no-token", "off", "false", "0", "disabled":
            return true
        default:
            return false
        }
    }

    private func serializedRegistry() -> String {
        var lines = [
            "# DeepSeek Harness local project launchers.",
            "#",
            "# Edit this file directly or use DeepSeek Harness Launcher.",
            "# Format is tab-separated:",
            "#",
            "# name<TAB>absolute project path<TAB>port<TAB>token|no-token",
            "#",
            "# The fourth column is optional. Use no-token to skip the launch",
            "# token so http://127.0.0.1:<port>/ opens without a cookie exchange.",
            "#",
            "# After adding a row, run it with:",
            "#   dsh-project name --open",
            "#",
            "# Optional shortcut:",
            "#   ln -sfn ~/.local/bin/dsh-project ~/.local/bin/dsh-name",
            "#",
            "# Keep names lowercase/simple if you want easy shell commands.",
            ""
        ]

        lines.append(contentsOf: projects.map { project in
            let auth = project.disableTokenAuth ? "no-token" : "token"
            return "\(project.name)\t\(project.path)\t\(project.port)\t\(auth)"
        })
        lines.append("")
        return lines.joined(separator: "\n")
    }
}

@MainActor
struct BindingProject {
    let registry: ProjectRegistry
    let index: Int

    var project: HarnessProject {
        get { registry.projects[index] }
        nonmutating set { registry.projects[index] = newValue }
    }
}
