from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.system_settings import SystemSettings
import logging

logger = logging.getLogger(__name__)

class SettingsService:
    """Service for managing system-wide settings"""
    
    def __init__(self):
        self._cache = {}
    
    async def get(self, db: AsyncSession, key: str, default=None):
        """Get a setting value"""
        # Check cache first
        if key in self._cache:
            return self._cache[key]
        
        # Query database
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if not setting:
            return default
        
        # Convert based on type
        value = setting.value
        if setting.value_type == 'bool':
            value = value.lower() in ('true', '1', 'yes', 'on')
        elif setting.value_type == 'int':
            value = int(value) if value else 0
        
        # Cache it
        self._cache[key] = value
        return value
    
    async def set(self, db: AsyncSession, key: str, value, value_type: str = 'string'):
        """Set a setting value"""
        # Convert value to string
        str_value = str(value).lower() if value_type == 'bool' else str(value)
        
        # Update or insert
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if setting:
            setting.value = str_value
            setting.value_type = value_type
        else:
            setting = SystemSettings(
                key=key,
                value=str_value,
                value_type=value_type
            )
            db.add(setting)
        
        await db.commit()
        
        # Update cache
        if value_type == 'bool':
            self._cache[key] = str_value.lower() in ('true', '1', 'yes', 'on')
        elif value_type == 'int':
            self._cache[key] = int(str_value) if str_value else 0
        else:
            self._cache[key] = str_value
        
        logger.info(f"Setting updated: {key} = {str_value}")
    
    async def get_all(self, db: AsyncSession):
        """Get all settings"""
        result = await db.execute(select(SystemSettings))
        settings = result.scalars().all()
        
        return {
            s.key: {
                'value': s.value,
                'type': s.value_type,
                'description': s.description
            } for s in settings
        }
    
    def clear_cache(self):
        """Clear settings cache"""
        self._cache = {}
        logger.info("Settings cache cleared")

settings_service = SettingsService()
