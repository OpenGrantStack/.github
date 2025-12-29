
Integration Tests

```python
# Example Python integration test
def test_grant_schema_validation():
    schema = load_schema('grant.json')
    test_data = load_example('grant-example.json')
    
    validator = JSONSchemaValidator(schema)
    result = validator.validate(test_data)
    
    assert result.valid == True
    assert len(result.errors) == 0




Support

Getting Help

· Documentation: https://docs.grantready.org
· API Reference: https://api.grantready.org/reference
· Support Email: api-support@grantready.org
· Status Page: https://status.grantready.org

SLAs

Tier Uptime Support Response Resolution Time
Free 99.0% 48 hours Best effort
Basic 99.5% 24 hours 5 business days
Enterprise 99.9% 4 hours 2 business days

---

Last Updated: [01/01/2026]
API Version: 2.1.0
Compliance: SOC 2 Type II, ISO 27001
