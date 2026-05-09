# Free Bughouse Player

This is a small project for the House Bughouse community (a Discord server with some of the strongest bughouse players from Chess.com). The main goal is pretty simple: give people a way to practice a very weird (and honestly confusing) tournament ruleset.

## Tournament Rule Set

The implementation tries to follow the rules from this tournament announcement:
https://www.facebook.com/61565311126427/posts/122098056560510370/

### Promotion Rules

* When a pawn promotes, the player has to pick a piece from the *diagonal board* (your partner’s opponent).
* That piece is placed on the promotion square.
* The pawn is then given to the diagonally opposite player.

**Important:**
You cannot select a piece that is **pinned** on the diagonal opponent’s board — i.e., a piece whose removal would leave the diagonal opponent’s king exposed to immediate capture. Pinned pieces are not eligible promotion targets, and a pawn cannot advance to the last rank if all eligible pieces on the diagonal board are pinned.

### Checkmate Rules

* You’re **not allowed** to checkmate by placing a piece.
* Checkmates have to come from a **normal move**.

## Purpose

This is mainly meant as a practice tool for anyone who wants to try out these rules without losing their mind in a real game first. If you’re playing in the tournament (or just curious), this should help you get used to the chaos.

Good luck and have fun 🙂

---

## Note

The code for this project was generated with the help of AI. I mainly focused on the design, rules, and overall idea behind it.
