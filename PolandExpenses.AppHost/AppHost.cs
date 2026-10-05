var builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.PolandExpenses_Api>("api")
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

builder.AddViteApp("web", "../src/PolandExpenses.Web")
    .WithNpm(installCommand: "ci")
    .WithHttpHealthCheck("/")
    .WithExternalHttpEndpoints();

await builder.Build().RunAsync().ConfigureAwait(false);
