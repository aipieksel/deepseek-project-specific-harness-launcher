import AppKit
import Combine
import Foundation

@MainActor
final class HarnessLauncher: ObservableObject {
    @Published private var processes: [HarnessProject.ID: Process] = [:]
    @Published private var outputs: [HarnessProject.ID: String] = [:]
    @Published private var tokenURLs: [HarnessProject.ID: URL] = [:]
    @Published var statusMessage = ""

    func isRunning(_ project: HarnessProject) -> Bool {
        processes[project.id]?.isRunning == true
    }

    func output(for project: HarnessProject) -> String {
        outputs[project.id] ?? ""
    }

    func tokenURL(for project: HarnessProject) -> URL? {
        tokenURLs[project.id]
    }

    func browserURL(for project: HarnessProject) -> URL? {
        if let tokenURL = tokenURLs[project.id] {
            return tokenURL
        }
        guard project.disableTokenAuth else { return nil }
        return URL(string: "http://127.0.0.1:\(project.port)/")
    }

    func launch(_ project: HarnessProject) {
        guard project.isValid else {
            statusMessage = "Fix the project name, path, or port before launching."
            return
        }

        guard FileManager.default.isExecutableFile(atPath: HarnessPaths.launcherURL.path) else {
            statusMessage = "Launcher is missing or not executable: \(HarnessPaths.launcherURL.path)"
            return
        }

        if isRunning(project) {
            if let browserURL = browserURL(for: project) {
                NSWorkspace.shared.open(browserURL)
                statusMessage = "Opened running \(project.name)."
            } else {
                statusMessage = "\(project.name) is already running."
            }
            return
        }

        let process = Process()
        process.executableURL = HarnessPaths.launcherURL
        var arguments = [project.name]
        if project.disableTokenAuth {
            arguments.append("--no-token")
        }
        arguments += ["--port", String(project.port), "--open"]
        process.arguments = arguments

        process.environment = HarnessPaths.launchEnvironment(
            disableTokenAuth: project.disableTokenAuth
        )

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        outputs[project.id] = ""
        tokenURLs[project.id] = nil

        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            Task { @MainActor in
                self?.append(text, for: project)
            }
        }

        process.terminationHandler = { [weak self, weak pipe] finishedProcess in
            pipe?.fileHandleForReading.readabilityHandler = nil
            Task { @MainActor in
                self?.processes[project.id] = nil
                self?.statusMessage = "\(project.name) stopped with status \(finishedProcess.terminationStatus)."
            }
        }

        do {
            try process.run()
            processes[project.id] = process
            statusMessage = "Launching \(project.name) on port \(project.port)."
        } catch {
            pipe.fileHandleForReading.readabilityHandler = nil
            statusMessage = "Launch failed: \(error.localizedDescription)"
        }
    }

    func stop(_ project: HarnessProject) {
        guard let process = processes[project.id] else {
            statusMessage = "\(project.name) is not running."
            return
        }
        process.terminate()
        statusMessage = "Stopping \(project.name)."
    }

    func openBrowser(for project: HarnessProject) {
        if let browserURL = browserURL(for: project) {
            NSWorkspace.shared.open(browserURL)
            statusMessage = "Opened \(project.name)."
        } else {
            statusMessage = "No browser URL yet. Launch the project first."
        }
    }

    private func append(_ text: String, for project: HarnessProject) {
        let current = outputs[project.id] ?? ""
        outputs[project.id] = String((current + text).suffix(12_000))

        for line in text.split(whereSeparator: \.isNewline) {
            let prefix = "dsh web: "
            guard line.hasPrefix(prefix) else { continue }
            let rawURL = line.dropFirst(prefix.count)
            if let url = URL(string: String(rawURL)) {
                tokenURLs[project.id] = url
            }
        }
    }
}
