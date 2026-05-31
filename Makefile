.PHONY: s c

s:
	cd apps/server && npm run start:dev

c:
	cd apps/client && npm run dev
