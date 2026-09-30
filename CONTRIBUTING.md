# Contributing to ArduDeck

Thanks for your interest in contributing to ArduDeck! This guide covers what you need to know before submitting a contribution.

---

## Contributor License Agreement (CLA)

All contributions to ArduDeck require agreement to our [Contributor License Agreement](CLA.md).

### Why?

ArduDeck is licensed under GPL v3 with a [Marketplace Module Exception](MODULE-EXCEPTION.md) that allows third-party modules sold through the official ArduDeck Hangar to use proprietary licenses. To maintain this dual-licensing structure, we need sufficient rights over all contributed code. The CLA grants the project maintainer (Ruben M) the ability to manage licensing while keeping ArduDeck open source.

### How to agree

Include this line in your first pull request description:

```
I have read and agree to the ArduDeck Contributor License Agreement (CLA.md).
```

Pull requests from contributors who have not agreed to the CLA cannot be merged.

---

## Getting Started

1. Fork the repository
2. Create a feature branch from `master`
3. Make your changes
4. Ensure your code passes checks:
   ```bash
   npx tsc --noEmit
   npx eslint .
   ```
5. Submit a pull request against `master`

---

## Code Guidelines

- **TypeScript strict mode** — handle `undefined` from indexed access (`noUncheckedIndexedAccess` is enabled)
- **No emojis in UI** — use [Lucide React](https://lucide.dev/) icons instead
- **Use existing components** — especially `DraggableSlider` for all slider UIs
- **Check reference implementations** before implementing MSP/MAVLink features (see `CLAUDE.md` for details)

---

## Reporting Issues

Open an issue on the repository. Include:
- Steps to reproduce
- Expected vs actual behavior
- Hardware/firmware details (if applicable)

---

## Questions?

Open an issue or reach out to the project maintainer.
