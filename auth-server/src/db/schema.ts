import { pgSchema, index, unique, text, boolean, integer, timestamp, foreignKey, uniqueIndex } from "drizzle-orm/pg-core"

export const auth = pgSchema("auth");
export const userRoleInAuth = auth.enum("user_role", ['user', 'admin'])

export const userInAuth = auth.table("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	role: userRoleInAuth().default('user').notNull(),
	banned: boolean().default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { mode: 'string' }),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_auth_user_banned").using("btree", table.banned.asc().nullsLast().op("bool_ops")),
	index("idx_auth_user_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_auth_user_role").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	unique("user_email_key").on(table.email),
]);

export const sessionInAuth = auth.table("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
	impersonatedBy: text("impersonated_by"),
}, (table) => [
	index("idx_auth_session_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_auth_session_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("idx_auth_session_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInAuth.id],
			name: "session_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.impersonatedBy],
			foreignColumns: [userInAuth.id],
			name: "session_impersonated_by_fkey"
		}),
	unique("session_token_key").on(table.token),
]);

export const accountInAuth = auth.table("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_auth_account_provider_account").using("btree", table.providerId.asc().nullsLast().op("text_ops"), table.accountId.asc().nullsLast().op("text_ops")),
	index("idx_auth_account_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInAuth.id],
			name: "account_user_id_fkey"
		}).onDelete("cascade"),
]);

export const verificationInAuth = auth.table("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_auth_verification_identifier").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
	index("idx_auth_verification_value").using("btree", table.value.asc().nullsLast().op("text_ops")),
]);

export const jwksInAuth = auth.table("jwks", {
	id: text().primaryKey().notNull(),
	publicKey: text("public_key").notNull(),
	privateKey: text("private_key").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	// Added for better-auth 1.6: the jwt plugin reads jwks.expiresAt for key
	// rotation. Nullable — null means the key never expires (prior behavior).
	expiresAt: timestamp("expires_at", { mode: 'string' }),
});

// Passkey (WebAuthn) credentials — better-auth passkey plugin. Field set mirrors
// @better-auth/passkey's schema; camelCase fields map to snake_case columns to
// match the rest of the auth schema.
export const passkeyInAuth = auth.table("passkey", {
	id: text().primaryKey().notNull(),
	name: text(),
	publicKey: text("public_key").notNull(),
	userId: text("user_id").notNull(),
	// Property MUST be `credentialID` (capital ID): the better-auth passkey
	// plugin references this field as `credentialID`, and the drizzle adapter
	// maps by property name. The DB column stays snake_case `credential_id`.
	credentialID: text("credential_id").notNull(),
	counter: integer().notNull(),
	deviceType: text("device_type").notNull(),
	backedUp: boolean("backed_up").notNull(),
	transports: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	aaguid: text(),
}, (table) => [
	index("idx_auth_passkey_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("idx_auth_passkey_credential_id").using("btree", table.credentialID.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInAuth.id],
			name: "passkey_user_id_fkey"
		}).onDelete("cascade"),
]);
