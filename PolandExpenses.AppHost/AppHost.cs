const int GeneratedSigningKeyLength = 64;

var builder = DistributedApplication.CreateBuilder(args);

var database = builder.AddPostgres("postgres")
    .WithDataVolume()
    .AddDatabase("expenses");

var signingKey = builder.AddParameter("jwt-signing-key", new GenerateParameterDefault { MinLength = GeneratedSigningKeyLength }, secret: true, persist: true);

builder.AddProject<Projects.PolandExpenses_Api>("api")
    .WithReference(database)
    .WaitFor(database)
    .WithEnvironment("Jwt__SigningKey", signingKey)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

builder.AddViteApp("web", "../src/PolandExpenses.Web")
    .WithNpm(installCommand: "ci")
    .WithHttpHealthCheck("/")
    .WithExternalHttpEndpoints();

await builder.Build().RunAsync().ConfigureAwait(false);
