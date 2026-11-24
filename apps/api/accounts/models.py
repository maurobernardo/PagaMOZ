from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models

# Formato E.164 moçambicano: +258 seguido de 9 dígitos (8x móvel, 2x fixo).
phone_validator = RegexValidator(r"^\+258[28]\d{8}$", "Use o formato +258XXXXXXXXX.")


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, phone, password=None, **extra):
        user = self.model(phone=phone, **extra)
        user.set_password(password)  # None -> unusable password (login por OTP)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self.create_user(phone, password, **extra)


class User(AbstractUser):
    username = None
    phone = models.CharField("telefone", max_length=13, unique=True, validators=[phone_validator])
    email = models.EmailField(blank=True)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS: list[str] = []
    objects = UserManager()

    def __str__(self):
        return self.get_full_name() or self.phone
