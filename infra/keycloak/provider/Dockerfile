# Compile against the exact runtime SPI without a host JDK or Maven dependency.
FROM quay.io/keycloak/keycloak:26.8.1 AS keycloak
FROM eclipse-temurin:21-jdk@sha256:ebfbb18d11ff163ee83b21258acf12248af48d22a0fdfdc68fa1a1516c05976a AS compiler
COPY --from=keycloak /opt/keycloak/lib/lib/main/ /keycloak/
WORKDIR /build
COPY PocketLedgerRegistration.java .
COPY org.keycloak.authentication.FormActionFactory classes/META-INF/services/org.keycloak.authentication.FormActionFactory
RUN javac --release 21 -cp '/keycloak/*' -d classes PocketLedgerRegistration.java \
    && jar --create --file pocketledger-registration.jar -C classes .
FROM scratch
COPY --from=compiler /build/pocketledger-registration.jar /
