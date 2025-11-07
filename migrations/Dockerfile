FROM migrate/migrate:latest

COPY *.sql /migrations/

ENTRYPOINT ["migrate", "-path=/migrations", "-database"]
CMD ["up"]
