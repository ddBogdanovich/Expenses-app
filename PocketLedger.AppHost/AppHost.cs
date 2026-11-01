const int GeneratedSigningKeyLength = 64;
const string LocalPostgresVolumeName = "pocketledger-postgres-data";

var builder = DistributedApplication.CreateBuilder(args);

var database = builder.AddPostgres("postgres")
    .WithDataVolume(LocalPostgresVolumeName)
    .AddDatabase("expenses");

var signingKey = builder.AddParameter("jwt-signing-key", new GenerateParameterDefault { MinLength = GeneratedSigningKeyLength }, secret: true, persist: true);

builder.AddProject<Projects.PocketLedger_Api>("api")
    .WithReference(database)
    .WaitFor(database)
    .WithEnvironment("Jwt__SigningKey", signingKey)
    .WithHttpHealthCheck("/api/health")
    .WithExternalHttpEndpoints();

builder.AddViteApp("web", "../src/PocketLedger.Web")
    .WithNpm(installCommand: "ci")
    .WithHttpHealthCheck("/")
    .WithExternalHttpEndpoints();

if (builder.ExecutionContext.IsRunMode)
{
    var repositoryDirectory = Path.GetFullPath(Path.Combine(builder.AppHostDirectory, ".."));
    var testArtifactsDirectory = Path.Combine(repositoryDirectory, ".artifacts", "tests");

    // A separate output tree lets tests rebuild without replacing the running API's assemblies.
    builder.AddExecutable("tests", "dotnet", repositoryDirectory,
            "test", "PocketLedger.slnx", "--artifacts-path", testArtifactsDirectory,
            "--logger", "console;verbosity=normal")
        .WithExplicitStart();
}

await builder.Build().RunAsync().ConfigureAwait(false);
