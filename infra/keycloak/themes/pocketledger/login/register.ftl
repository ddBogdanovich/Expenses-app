<#import "pocketledger.ftl" as layout>
<#assign emailError = messagesPerField.existsError('email', 'username')>
<#assign passwordError = messagesPerField.existsError('password', 'password-confirm')>
<@layout.page title="Create your account">
    <span class="eyebrow">WELCOME TO POCKETLEDGER</span>
    <h1 id="form-heading">Make room for clarity.</h1>
    <p class="form-intro">Create your account to get started.</p>
    <form id="kc-register-form" class="ledger-form" action="${url.registrationAction}" method="post">
        <#if message?has_content && !emailError && !passwordError>
            <p class="notice notice--danger" role="alert" tabindex="-1" data-form-error>We couldn’t create your account. Check your details and try again.</p>
        </#if>
        <div class="textfield" data-required="true">
            <label class="label" for="email">Email address</label>
            <input class="input input--primary ledger-input" id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" enterkeyhint="next" value="${(register.formData.email)!''}" placeholder="you@example.com" required <#if emailError>aria-invalid="true" aria-describedby="input-error-email"</#if>>
            <#if emailError><p id="input-error-email" class="field-error" data-visible="true" role="alert">${kcSanitize(messagesPerField.getFirstError('email', 'username'))?no_esc}</p></#if>
        </div>
        <div class="textfield" data-required="true">
            <label class="label" for="password">Password</label>
            <div class="password-input">
                <input class="input input--primary ledger-input" id="password" name="password" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" enterkeyhint="go" placeholder="Create a password" required minlength="${properties.passwordMinimumLength}" maxlength="${properties.passwordMaximumLength}" aria-describedby="password-help<#if passwordError> input-error-password</#if>" <#if passwordError>aria-invalid="true"</#if>>
                <button class="button button--ghost button--sm password-toggle" type="button" data-password-toggle aria-controls="password" aria-label="Show password" aria-pressed="false">Show</button>
            </div>
            <p id="password-help" class="description">Use ${properties.passwordMinimumLength}–${properties.passwordMaximumLength} characters. A few words work well.</p>
            <#if passwordError><p id="input-error-password" class="field-error" data-visible="true" role="alert">${kcSanitize(messagesPerField.getFirstError('password', 'password-confirm'))?no_esc}</p></#if>
        </div>
        <button class="button button--primary primary-action" type="submit" data-pending-label="Creating your account…">Create account <span aria-hidden="true">↗</span></button>
    </form>
    <p class="form-footnote">Already have an account? <a class="account-link" href="${url.loginUrl}">Log in</a></p>
</@layout.page>
