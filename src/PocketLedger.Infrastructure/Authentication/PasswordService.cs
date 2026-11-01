using Microsoft.AspNetCore.Identity;
using PocketLedger.UseCases.Authentication.Common;

namespace PocketLedger.Infrastructure.Authentication;

internal sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<object> _hasher = new();
    private readonly object _user = new();
    private readonly string _dummyHash;

    public PasswordService() => _dummyHash = _hasher.HashPassword(_user, Guid.NewGuid().ToString());

    public string Hash(string password) => _hasher.HashPassword(_user, password);

    public bool Verify(string passwordHash, string password) =>
        _hasher.VerifyHashedPassword(_user, string.IsNullOrEmpty(passwordHash) ? _dummyHash : passwordHash, password)
            != PasswordVerificationResult.Failed;
}
