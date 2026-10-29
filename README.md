# Pixel office

A pixel-art office building in a pane beside the chat. Each chat has its own building, named after
its folder ("<folder> Office"). Every character has a name, and each office is named after the one
who works there. The lead walks to their desk whenever Claude is working; the bigger the job (5, 15
and 30 actions in one reply), the more of the crew come in to help. Real helper agents get offices
too. At their desks they show what they are doing: reading, editing, running a command, thinking,
or a red "!" when something failed. Off the clock, they wander round the break room. Type `/office`
to open it.

Name your office's people with `/office names Dave, Sue, Max, Lily`: the first is the lead, the next
three the crew, any more go to helper agents. `/office names` shows them, and `/office names random`
goes back to random names. Your names are kept for every chat on your computer.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install pixel-office --marketplace jmann184/pixel-office
```

From a shell:

```
claude plugin install pixel-office --marketplace jmann184/pixel-office
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with
`jmann184/pixel-office`, then Add plugin.

Pixel art by Kenney (kenney.nl), CC0: Roguelike Indoors and Roguelike Characters. Licences are in `assets/`.
