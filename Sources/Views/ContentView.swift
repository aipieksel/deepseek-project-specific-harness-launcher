import AppKit
import SwiftUI

struct ContentView: View {
    @StateObject private var registry = ProjectRegistry()
    @StateObject private var launcher = HarnessLauncher()

    var body: some View {
        NavigationSplitView {
            sidebar
                .navigationSplitViewColumnWidth(min: 260, ideal: 300, max: 360)
        } detail: {
            detail
        }
        .toolbar {
            ToolbarItemGroup {
                Button {
                    registry.addProject()
                } label: {
                    Label("Add", systemImage: "plus")
                }

                Button {
                    registry.save()
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                }

                Button {
                    registry.load()
                } label: {
                    Label("Reload", systemImage: "arrow.clockwise")
                }
            }
        }
    }

    private var sidebar: some View {
        VStack(spacing: 0) {
            List(selection: $registry.selectedID) {
                ForEach(registry.projects) { project in
                    ProjectRow(
                        project: project,
                        isRunning: launcher.isRunning(project)
                    )
                    .tag(project.id)
                }
            }
            .listStyle(.sidebar)

            Divider()

            HStack {
                Button {
                    NSWorkspace.shared.open(registry.registryURL)
                } label: {
                    Label("Config", systemImage: "doc.text")
                }

                Spacer()

                Text("\(registry.projects.count) projects")
                    .foregroundStyle(.secondary)
            }
            .padding(10)
        }
    }

    @ViewBuilder
    private var detail: some View {
        if let binding = selectedProjectBinding {
            ProjectDetailView(
                project: binding,
                registry: registry,
                launcher: launcher
            )
        } else {
            ContentUnavailableView(
                "No Project Selected",
                systemImage: "terminal",
                description: Text("Add or select a project to launch DeepSeek Harness.")
            )
        }
    }

    private var selectedProjectBinding: Binding<HarnessProject>? {
        guard let id = registry.selectedID,
              let index = registry.projects.firstIndex(where: { $0.id == id })
        else { return nil }

        return Binding(
            get: { registry.projects[index] },
            set: { registry.projects[index] = $0 }
        )
    }
}

private struct ProjectRow: View {
    let project: HarnessProject
    let isRunning: Bool

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(project.name)
                        .fontWeight(.medium)
                        .lineLimit(1)

                    if isRunning {
                        Circle()
                            .fill(.green)
                            .frame(width: 7, height: 7)
                    }
                }

                Text(":\(project.port)  \(project.path)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        } icon: {
            Image(systemName: isRunning ? "play.circle.fill" : "terminal")
                .foregroundStyle(isRunning ? .green : .secondary)
        }
    }
}
