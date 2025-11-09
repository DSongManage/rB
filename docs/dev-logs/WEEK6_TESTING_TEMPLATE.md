# Week 6 User Testing Template - renaissBlock

**Purpose**: Systematically test and gather feedback for renaissBlock MVP  
**Duration**: 5-7 days  
**Goal**: Identify bugs, UX issues, and improvement opportunities

---

## 📋 Testing Session Template

**Copy this template for each testing session**

---

### Session Metadata

- **Date**: _________________
- **Tester ID**: _________________
- **Role**: [ ] Creator [ ] Collector [ ] Collaborator
- **Device**: [ ] Desktop [ ] Mobile [ ] Tablet
- **Browser**: [ ] Chrome [ ] Firefox [ ] Safari [ ] Other: ______
- **Prior Web3 Experience**: [ ] None [ ] Beginner [ ] Intermediate [ ] Advanced

---

## 🎯 Scenario 1: Creator Flow (Complete Journey)

### Task 1.1: Signup & Account Setup
**Steps**:
1. Navigate to http://localhost:3000/auth
2. Choose signup method: [ ] Web3Auth [ ] Manual wallet
3. Complete signup process
4. Link Solana wallet (if not done in step 2)

**Time Tracking**:
- Start time: __:__
- End time: __:__
- **Total duration**: _____ minutes

**Observations**:
- [ ] ✅ Completed without issues
- [ ] ⚠️ Completed with minor issues (describe below)
- [ ] ❌ Could not complete (blocker - describe below)

**Notes**:
```
[Describe any confusion, errors, or suggestions]
```

---

### Task 1.2: Content Creation
**Steps**:
1. Navigate to /studio
2. Select content type: [ ] Text [ ] Image [ ] Video
3. Enter title and upload/create content
4. Submit and verify content created

**Time Tracking**:
- Start time: __:__
- End time: __:__
- **Total duration**: _____ minutes
- **Upload time** (if file): _____ seconds

**Observations**:
- [ ] ✅ Completed without issues
- [ ] ⚠️ Completed with minor issues (describe below)
- [ ] ❌ Could not complete (blocker - describe below)

**Notes**:
```
[File size, upload speed, any errors, UI confusion]
```

---

### Task 1.3: Customize NFT Settings
**Steps**:
1. Set teaser percentage (0-100%)
2. Enable/disable watermark
3. Set price per edition (USD)
4. Set number of editions
5. (Future) Add collaborator splits

**Observations**:
- [ ] ✅ Settings clear and intuitive
- [ ] ⚠️ Some confusion (describe below)
- [ ] ❌ Could not understand settings

**Notes**:
```
[Clarity of options, default values, validation feedback]
```

---

### Task 1.4: Preview Content
**Steps**:
1. Click preview button
2. Verify teaser renders correctly
3. Check watermark visibility (if enabled)
4. Close preview

**Performance**:
- **Preview load time**: _____ seconds
- **Watermark quality**: [ ] Good [ ] Acceptable [ ] Poor

**Observations**:
- [ ] ✅ Preview works perfectly
- [ ] ⚠️ Minor rendering issues (describe below)
- [ ] ❌ Preview broken or won't load

**Notes**:
```
[Load time, rendering quality, watermark placement]
```

---

### Task 1.5: Mint NFT
**Steps**:
1. Click "Mint & Publish"
2. Enter sale amount (if prompted)
3. Confirm transaction
4. Verify success message and tx signature

**Time Tracking**:
- **Mint duration**: _____ seconds

**Observations**:
- [ ] ✅ Minted successfully
- [ ] ⚠️ Minted with warnings (describe below)
- [ ] ❌ Mint failed (error - describe below)

**Transaction Details**:
- **TX Signature**: _________________________________
- **Sale Amount**: _____________ lamports
- **Expected Fee**: _____________ lamports (10%)

**Notes**:
```
[Error messages, confirmation clarity, tx signature display]
```

---

### Task 1.6: Verify in Profile
**Steps**:
1. Navigate to /profile
2. Find newly minted content
3. Click to view details
4. Verify metadata correct

**Observations**:
- [ ] ✅ Content appears correctly
- [ ] ⚠️ Some data missing or incorrect
- [ ] ❌ Content not found

**Notes**:
```
[Data accuracy, display formatting, navigation]
```

---

## 🔍 Scenario 2: Collector Flow (Discovery & Preview)

### Task 2.1: Browse Content
**Steps**:
1. Navigate to /search or homepage
2. Browse available content
3. Use filters (type, genre)
4. Click on content to view details

**Observations**:
- [ ] ✅ Easy to find content
- [ ] ⚠️ Search needs improvement (describe below)
- [ ] ❌ Could not find any content

**Notes**:
```
[Search effectiveness, filter usefulness, content display]
```

---

### Task 2.2: View Preview/Teaser
**Steps**:
1. Click preview on content
2. View teaser (limited %)
3. Observe watermark
4. Decide if want to purchase

**Observations**:
- [ ] ✅ Teaser shows enough to judge quality
- [ ] ⚠️ Teaser too limited or too much
- [ ] ❌ Teaser doesn't work

**Notes**:
```
[Teaser length appropriateness, watermark effectiveness, purchase desire]
```

---

## 🤝 Scenario 3: Collaborator Search

### Task 3.1: Find Collaborators
**Steps**:
1. Navigate to /collaborators
2. Search by role (e.g., "artist")
3. Search by genre (e.g., "fantasy")
4. Search by location (optional)

**Observations**:
- [ ] ✅ Found relevant collaborators
- [ ] ⚠️ Results not very relevant
- [ ] ❌ No results or search broken

**Notes**:
```
[Search relevance, filter effectiveness, profile information quality]
```

---

## 🐛 Bug Report Section

**Fill out for each bug encountered**

### Bug #1
- **Severity**: [ ] Critical [ ] High [ ] Medium [ ] Low
- **Component**: [ ] Frontend [ ] Backend [ ] Blockchain
- **Description**:
  ```
  [What went wrong?]
  ```
- **Steps to Reproduce**:
  ```
  1.
  2.
  3.
  ```
- **Expected Behavior**:
  ```
  [What should have happened?]
  ```
- **Actual Behavior**:
  ```
  [What actually happened?]
  ```
- **Error Messages** (if any):
  ```
  [Copy exact error text or screenshot]
  ```

### Bug #2
[Repeat template above]

---

## 💡 Improvement Suggestions

### UX Improvements
1. _________________________________________
2. _________________________________________
3. _________________________________________

### Feature Requests
1. _________________________________________
2. _________________________________________
3. _________________________________________

### Performance Issues
1. _________________________________________
2. _________________________________________

---

## 📊 Rating & Feedback

### Overall Experience
**Rate 1-5 stars** (5 = excellent, 1 = poor)

- **Ease of Signup**: ⭐ ⭐ ⭐ ⭐ ⭐
- **Content Creation**: ⭐ ⭐ ⭐ ⭐ ⭐
- **Minting Process**: ⭐ ⭐ ⭐ ⭐ ⭐
- **Preview Quality**: ⭐ ⭐ ⭐ ⭐ ⭐
- **Overall UX**: ⭐ ⭐ ⭐ ⭐ ⭐

### Would you use this product?
- [ ] Yes, definitely
- [ ] Yes, with improvements
- [ ] Maybe, needs significant work
- [ ] No, too many issues

### What did you like most?
```
[Free text]
```

### What needs improvement most?
```
[Free text]
```

### Additional Comments
```
[Free text]
```

---

## 🎯 Testing Completion Checklist

- [ ] Completed Creator flow (all 6 tasks)
- [ ] Completed Collector flow (2 tasks)
- [ ] Completed Collaborator search
- [ ] Documented all bugs encountered
- [ ] Provided improvement suggestions
- [ ] Submitted ratings and feedback
- [ ] Tested on primary device/browser
- [ ] (Optional) Tested on secondary device/browser

---

## 📧 Submission

**Submit completed template to**: [Your project email/repo issue]

**Thank you for testing renaissBlock!** Your feedback helps us build a better platform for creators. 🙏

---

## 📝 For Internal Use

### Aggregation Template

After collecting 5-10 sessions, aggregate results:

```python
# Example aggregation script
sessions = [
    {'signup': 3.5, 'create': 8.2, 'mint': 1.5, 'bugs': 2, 'rating': 4},
    {'signup': 2.1, 'create': 6.5, 'mint': 2.0, 'bugs': 1, 'rating': 5},
    # ... more sessions
]

avg_signup = sum(s['signup'] for s in sessions) / len(sessions)
avg_create = sum(s['create'] for s in sessions) / len(sessions)
avg_mint = sum(s['mint'] for s in sessions) / len(sessions)
total_bugs = sum(s['bugs'] for s in sessions)
avg_rating = sum(s['rating'] for s in sessions) / len(sessions)

print(f"Average Signup Time: {avg_signup:.1f} min")
print(f"Average Create Time: {avg_create:.1f} min")
print(f"Average Mint Time: {avg_mint:.1f} min")
print(f"Total Bugs Reported: {total_bugs}")
print(f"Average Rating: {avg_rating:.1f}/5.0")
```

**Target Metrics**:
- Signup: <5 min
- Create: <10 min
- Mint: <2 min
- Bugs: <3 per session
- Rating: >4.0/5.0

