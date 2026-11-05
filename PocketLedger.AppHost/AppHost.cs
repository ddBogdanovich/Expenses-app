const int GeneratedSigningKeyLength = 64;
const int BrowserPort = 5173;
const int KeycloakBrowserPort = 8080;
const string IdentityPostgresVolumeName = "pocketledger-identity-postgres-data";
const string KeycloakImageTag = "26.8.1";
const string LocalPostgresVolumeName = "pocketledger-postgres-data";

var builder = DistributedApplication.CreateBuilder(args);

var database = builder.AddPostgres("postgres")
    .WithDataVolume(LocalPostgresVolumeName)
    .AddDatabase("expenses");

var signingKey = builder.AddParameter("jwt-signing-key", new GenerateParameterDefault { MinLength = GeneratedSigningKeyLength }, secret: true, persist: true);

var identityDatabase = builder.AddPostgres("identity-postgres")
    .WithDataVolume(IdentityPostgresVolumeName)
    .AddDatabase("keycloak-db", "keycloak");
var clientSecret = builder.AddParameter("keycloak-client-secret", new GenerateParameterDefault { MinLength = GeneratedSigningKeyLength }, secret: true, persist: true);
var keycloakAdminPassword = builder.AddParameter("keycloak-password", new GenerateParameterDefault { MinLength = GeneratedSigningKeyLength }, secret: true, persist: true);
var keycloak = builder.AddKeycloak("keycloak", KeycloakBrowserPort, adminPassword: keycloakAdminPassword)
    .WithImageTag(KeycloakImageTag)
    .WithArgs("--spi-theme--cache-themes=false", "--spi-theme--cache-templates=false", "--spi-theme--static-max-age=-1")
    .WithEnvironment("KC_DB", "postgres")
    .WithEnvironment("KC_DB_URL", identityDatabase.Resource.JdbcConnectionString)
    .WithEnvironment("KC_DB_USERNAME", identityDatabase.Resource.Parent.UserNameReference)
    .WithEnvironment("KC_DB_PASSWORD", identityDatabase.Resource.Parent.PasswordParameter)
    .WithEnvironment("POCKETLEDGER_CLIENT_SECRET", clientSecret)
    .WithRealmImport("../infra/keycloak/pocketledger-realm.json")
    .WithBindMount("../.artifacts/keycloak-provider/pocketledger-registration.jar", "/opt/keycloak/providers/pocketledger-registration.jar", isReadOnly: true)
    .WithBindMount("../.artifacts/keycloak-theme/pocketledger", "/opt/keycloak/themes/pocketledger", isReadOnly: true)
    .WaitFor(identityDatabase);

var api = builder.AddProject<Projects.PocketLedger_Api>("api")
    .WithReference(database)
    .WaitFor(database)
    .WithEnvironment("Jwt__SigningKey", signingKey)
    .WithHttpHealthCheck("/api/health")
    .WithExternalHttpEndpoints();

var web = builder.AddViteApp("web", "../src/PocketLedger.Web")
    .WithEndpoint("http", endpoint => endpoint.Port = BrowserPort)
    .WithNpm(installCommand: "ci")
    .WithEnvironment("API_BASE_URL", api.GetEndpoint("http"))
    .WaitFor(api)
    .WithHttpHealthCheck("/")
    .WithExternalHttpEndpoints();

api.WithEnvironment("Keycloak__Enabled", "true")
    .WithEnvironment("Keycloak__Authority", ReferenceExpression.Create($"{keycloak.GetEndpoint("http")}/realms/pocketledger"))
    .WithEnvironment("Keycloak__ClientSecret", clientSecret)
    .WithEnvironment("Keycloak__BrowserOrigin", web.GetEndpoint("http"))
    .WithEnvironment("OTEL_DOTNET_EXPERIMENTAL_ASPNETCORE_DISABLE_URL_QUERY_REDACTION", "false")
    .WithEnvironment("OTEL_DOTNET_EXPERIMENTAL_HTTPCLIENT_DISABLE_URL_QUERY_REDACTION", "false")
    .WaitFor(keycloak);
// Redirect URIs are browser addresses, not container-rebased service endpoints.
keycloak.WithEnvironment(context => context.EnvironmentVariables["POCKETLEDGER_WEB_ORIGIN"] = web.GetEndpoint("http").Url);
var identityConfiguration = builder.AddNodeApp("keycloak-config", "../scripts", "configure-keycloak.mjs")
    .WithEnvironment("KEYCLOAK_URL", keycloak.GetEndpoint("http"))
    .WithEnvironment("KEYCLOAK_ADMIN_PASSWORD", keycloakAdminPassword)
    .WithEnvironment("POCKETLEDGER_WEB_ORIGIN", web.GetEndpoint("http"))
    .WaitFor(keycloak);
api.WaitForCompletion(identityConfiguration);

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
