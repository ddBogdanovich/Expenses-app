package pocketledger.identity;

import org.keycloak.Config;
import org.keycloak.authentication.RequiredActionContext;
import org.keycloak.authentication.RequiredActionFactory;
import org.keycloak.authentication.RequiredActionProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

/** Presents confirmation only for the server-created user in this registration transaction. */
public final class PocketLedgerRegistrationConfirmation implements RequiredActionProvider, RequiredActionFactory {
    public static final String PROVIDER_ID = "pocketledger-registration-confirmation";
    public static final String CREATED_USER_NOTE = "pocketledger.registration-created-user";

    private boolean isCreatedUser(RequiredActionContext context) {
        return context.getUser().getId().equals(context.getAuthenticationSession().getAuthNote(CREATED_USER_NOTE));
    }

    @Override
    public void evaluateTriggers(RequiredActionContext context) { }

    @Override
    public void requiredActionChallenge(RequiredActionContext context) {
        if (!isCreatedUser(context)) {
            context.failure("We couldn’t confirm this registration. Return to login and try again.");
            return;
        }
        context.challenge(context.form().setAttribute("confirmationEmail", context.getUser().getEmail())
            .createForm("registration-confirmation.ftl"));
    }

    @Override
    public void processAction(RequiredActionContext context) {
        if (!isCreatedUser(context)) {
            context.failure("We couldn’t confirm this registration. Return to login and try again.");
            return;
        }
        if (!context.getHttpRequest().getDecodedFormParameters().containsKey("continue")) {
            requiredActionChallenge(context);
            return;
        }
        context.getAuthenticationSession().removeAuthNote(CREATED_USER_NOTE);
        context.success();
    }

    @Override
    public String getId() { return PROVIDER_ID; }

    @Override
    public String getDisplayText() { return "PocketLedger registration confirmation"; }

    @Override
    public RequiredActionProvider create(KeycloakSession session) { return this; }

    @Override
    public void init(Config.Scope config) { }

    @Override
    public void postInit(KeycloakSessionFactory factory) { }

    @Override
    public void close() { }
}
