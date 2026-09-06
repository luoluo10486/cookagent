package com.foodmate.infrastructure.persistence.runtime;

import com.foodmate.application.runtime.port.out.ToolRegistryRepository.ToolDefinition;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** PostgreSQL 工具注册表只读查询。注册元数据由版本化 SQL 种子维护。 */
@Mapper
public interface ToolRegistryMapper {
    @Select(
            "SELECT t.tool_id AS toolId,t.name,t.display_name AS"
                    + " displayName,t.description,t.category,t.risk_level AS"
                    + " riskLevel,t.availability_scope AS availabilityScope,t.status,t.current_version"
                    + " AS currentVersion,s.version,s.input_schema::text AS"
                    + " inputSchemaJson,s.output_schema::text AS outputSchemaJson,s.permissions::text"
                    + " AS permissionsJson,s.timeout_ms AS"
                    + " timeoutMs,s.retryable,s.idempotent,s.published_at AS publishedAt,t.revision AS revision FROM"
                    + " tool_registries t LEFT JOIN tool_schema_versions s ON s.tool_id=t.tool_id AND"
                    + " s.version=t.current_version AND s.is_deleted=FALSE WHERE t.is_deleted=FALSE"
                    + " ORDER BY t.name")
    List<ToolDefinition> findAll();

    @Select(
            "SELECT t.tool_id AS toolId,t.name,t.display_name AS"
                    + " displayName,t.description,t.category,t.risk_level AS"
                    + " riskLevel,t.availability_scope AS availabilityScope,t.status,t.current_version"
                    + " AS currentVersion,s.version,s.input_schema::text AS"
                    + " inputSchemaJson,s.output_schema::text AS outputSchemaJson,s.permissions::text"
                    + " AS permissionsJson,s.timeout_ms AS"
                    + " timeoutMs,s.retryable,s.idempotent,s.published_at AS publishedAt,t.revision AS revision FROM"
                    + " tool_registries t JOIN tool_schema_versions s ON s.tool_id=t.tool_id AND"
                    + " s.version=t.current_version AND s.is_deleted=FALSE WHERE t.name=#{name} AND"
                    + " t.is_deleted=FALSE")
    ToolDefinition findCurrent(@Param("name") String name);

    @Select(
            "SELECT t.tool_id AS toolId,t.name,t.display_name AS"
                    + " displayName,t.description,t.category,t.risk_level AS"
                    + " riskLevel,t.availability_scope AS availabilityScope,t.status,t.current_version"
                    + " AS currentVersion,s.version,s.input_schema::text AS"
                    + " inputSchemaJson,s.output_schema::text AS outputSchemaJson,s.permissions::text"
                    + " AS permissionsJson,s.timeout_ms AS"
                    + " timeoutMs,s.retryable,s.idempotent,s.published_at AS publishedAt,t.revision AS revision FROM"
                    + " tool_registries t JOIN tool_schema_versions s ON s.tool_id=t.tool_id AND"
                    + " s.version=#{version} AND s.is_deleted=FALSE WHERE t.name=#{name} AND"
                    + " t.is_deleted=FALSE")
    ToolDefinition findVersion(@Param("name") String name, @Param("version") String version);
}
