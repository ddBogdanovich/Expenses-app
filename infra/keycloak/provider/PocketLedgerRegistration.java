package pocketledger.identity;

import java.util.Locale;
import org.keycloak.authentication.ValidationContext;
import org.keycloak.authentication.forms.RegistrationUserCreation;

/** Normalizes registration identity; Keycloak still validates and stores credentials. */
public final class PocketLedgerRegistration extends RegistrationUserCreation {
    public static final String PROVIDER_ID = "pocketledger-registration-policy";

    @Override
    public String getId() { return PROVIDER_ID; }

    @Override
    public String getDisplayType() { return "PocketLedger email-only registration"; }

    @Override
    public void validate(ValidationContext context) {
        var form = context.getHttpRequest().getDecodedFormParameters();
        var email = form.getFirst("email");
        if (email != null) {
            form.putSingle("email", email.strip().toLowerCase(Locale.ROOT));
        }
        // The product asks for one password entry. Delegate policy validation,
        // hashing, and persistence to the built-in RegistrationPassword action.
        var password = form.getFirst("password");
        if (password != null) {
            form.putSingle("password-confirm", password);
        }
        super.validate(context);
    }
}
