var builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.PolandExpenses_Api>("api")
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

await builder.Build().RunAsync().ConfigureAwait(false);
