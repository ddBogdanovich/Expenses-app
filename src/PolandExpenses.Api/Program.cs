using PolandExpenses.Infrastructure;
using PolandExpenses.UseCases;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddUseCases();
builder.Services.AddInfrastructure();

var app = builder.Build();

app.MapDefaultEndpoints();
app.MapUseCaseEndpoints();

await app.RunAsync().ConfigureAwait(false);
