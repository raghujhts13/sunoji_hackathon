"""Test script for content safety module."""
from content_safety import check_content_safety, get_supportive_response

# Test various harmful content categories
test_cases = [
    ('I feel happy today!', False, 'none'),
    ('I want to kill myself', True, 'suicide_self_harm'),
    ('I want to hurt myself', True, 'self_harm'),
    ('My husband beats me', True, 'abuse'),
    ('I want to kill everyone', True, 'violence'),
    ('I am addicted to drugs and cannot stop using', True, 'substance_abuse'),
    ('How are you doing today?', False, 'none'),
]

print('=== Content Safety Tests ===')
passed = 0
failed = 0
for text, expected_harmful, expected_cat in test_cases:
    result = check_content_safety(text)
    if result.is_harmful == expected_harmful:
        status = 'PASS'
        passed += 1
    else:
        status = 'FAIL'
        failed += 1
    print(f'{status}: "{text[:40]}" -> harmful={result.is_harmful}, cat={result.category.value}')

print(f'\n=== Results: {passed} passed, {failed} failed ===')
